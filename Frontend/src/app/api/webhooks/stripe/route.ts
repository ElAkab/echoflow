import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
	apiVersion: "2026-01-28.clover",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

const resend = process.env.RESEND_API_KEY
	? new Resend(process.env.RESEND_API_KEY)
	: null;

// ── Zod schemas for metadata validation ────────────────────────────────────

const TopUpMetadataSchema = z.object({
	user_id: z.string().uuid(),
	credits: z.string().regex(/^\d+$/),
	type: z.literal("topup"),
});

const SubscriptionMetadataSchema = z.object({
	user_id: z.string().uuid(),
	type: z.literal("subscription"),
});

/**
 * POST /api/webhooks/stripe
 *
 * Handles Stripe webhook events for both billing models:
 *   - Top-up (one-time): checkout.session.completed (type=topup, payment_status=paid)
 *   - Pro subscription: checkout.session.completed (type=subscription)
 *                       customer.subscription.updated
 *                       customer.subscription.deleted
 *
 * Idempotency: tracked in processed_stripe_events table (DB-persisted).
 * Security: Stripe signature verified before any DB operation.
 * Auth: uses createAdminClient() (service role) — no user session in webhook context.
 */
export async function POST(request: NextRequest) {
	const payload = await request.text();
	const signature = request.headers.get("stripe-signature");

	if (!signature) {
		return NextResponse.json(
			{ error: "Missing stripe-signature header" },
			{ status: 400 },
		);
	}

	// ── 1. Verify Stripe signature ─────────────────────────────────────────
	let event: Stripe.Event;
	try {
		event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : "Unknown error";
		console.error("Webhook signature verification failed:", message);
		return NextResponse.json(
			{ error: `Webhook Error: ${message}` },
			{ status: 400 },
		);
	}

	const supabase = createAdminClient();

	// ── 2. DB-based idempotency check ──────────────────────────────────────
	const { data: alreadyProcessed } = await supabase
		.from("processed_stripe_events")
		.select("event_id")
		.eq("event_id", event.id)
		.maybeSingle();

	if (alreadyProcessed) {
		console.log(`[Webhook] Event ${event.id} already processed — skipping`);
		return NextResponse.json({ received: true, idempotent: true });
	}

	// ── 3. Handle events ───────────────────────────────────────────────────
	try {
		switch (event.type) {
			// ── Top-up purchase completed ──────────────────────────────────
			// ── Subscription checkout completed ───────────────────────────
			case "checkout.session.completed": {
				const session = event.data.object as Stripe.Checkout.Session;

				if (session.mode === "payment") {
					await handleTopUpCompleted(supabase, session);
				} else if (session.mode === "subscription") {
					await handleSubscriptionCheckoutCompleted(supabase, session);
				} else {
					console.log(
						`[Webhook] Skipping checkout session with unknown mode: ${session.mode}`,
					);
				}
				break;
			}

			// ── Subscription renewed or updated (status change) ────────────
			case "customer.subscription.updated": {
				const subscription = event.data.object as Stripe.Subscription;
				await handleSubscriptionUpdated(supabase, subscription);
				break;
			}

			// ── Subscription cancelled ─────────────────────────────────────
			case "customer.subscription.deleted": {
				const subscription = event.data.object as Stripe.Subscription;
				await handleSubscriptionDeleted(supabase, subscription);
				break;
			}

			default:
				console.log(`[Webhook] Unhandled event type: ${event.type}`);
		}

		// ── 4. Mark event as processed ──────────────────────────────────────
		await markProcessed(supabase, event.id);
		return NextResponse.json({ received: true, success: true });
	} catch (error) {
		console.error("[Webhook] Unexpected error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────────────────────

async function handleTopUpCompleted(
	supabase: ReturnType<typeof createAdminClient>,
	session: Stripe.Checkout.Session,
) {
	const metaParse = TopUpMetadataSchema.safeParse(session.metadata);

	if (!metaParse.success) {
		console.log(
			`[Webhook] Skipping non-topup session ${session.id}:`,
			metaParse.error.issues,
		);
		return;
	}

	if (session.payment_status !== "paid") {
		console.log(`[Webhook] Session ${session.id} not paid yet — skipping`);
		return;
	}

	const { user_id, credits: creditsStr } = metaParse.data;
	const creditAmount = parseInt(creditsStr, 10);

	const { data: rpcResult, error: rpcError } = await supabase.rpc(
		"add_credits",
		{
			p_user_id: user_id,
			p_amount: creditAmount,
			p_metadata: {
				stripe_session_id: session.id,
				stripe_payment_intent: session.payment_intent,
				amount_total: session.amount_total,
				currency: session.currency,
			},
		},
	);

	if (rpcError) {
		console.error("[Webhook] add_credits RPC error:", rpcError);
		throw new Error("Failed to add credits");
	}

	const newBalance = rpcResult?.[0]?.new_balance ?? creditAmount;
	console.log(
		`[Webhook] Top-up: +${creditAmount} credits → user ${user_id}. Balance: ${newBalance}`,
	);

	if (session.customer && typeof session.customer === "string") {
		await supabase
			.from("profiles")
			.update({ stripe_customer_id: session.customer })
			.eq("id", user_id);
	}

	await sendCreditEmail(supabase, user_id, creditAmount, newBalance);
}

async function handleSubscriptionCheckoutCompleted(
	supabase: ReturnType<typeof createAdminClient>,
	session: Stripe.Checkout.Session,
) {
	const metaParse = SubscriptionMetadataSchema.safeParse(session.metadata);

	if (!metaParse.success) {
		console.log(
			`[Webhook] Skipping subscription session without metadata ${session.id}:`,
			metaParse.error.issues,
		);
		return;
	}

	const { user_id } = metaParse.data;
	const subscriptionId =
		typeof session.subscription === "string"
			? session.subscription
			: session.subscription?.id ?? null;

	const { error } = await supabase
		.from("profiles")
		.update({
			subscription_status: "active",
			stripe_subscription_id: subscriptionId,
			...(session.customer && typeof session.customer === "string"
				? { stripe_customer_id: session.customer }
				: {}),
		})
		.eq("id", user_id);

	if (error) {
		console.error("[Webhook] Failed to activate subscription:", error);
		throw new Error("Failed to activate subscription");
	}

	console.log(
		`[Webhook] Subscription activated: user ${user_id}, sub ${subscriptionId}`,
	);
}

async function handleSubscriptionUpdated(
	supabase: ReturnType<typeof createAdminClient>,
	subscription: Stripe.Subscription,
) {
	// Map Stripe status → internal status
	const statusMap: Record<string, string> = {
		active: "active",
		past_due: "past_due",
		canceled: "cancelled",
		unpaid: "past_due",
		trialing: "active",
	};

	const newStatus = statusMap[subscription.status] ?? "inactive";

	const { error } = await supabase
		.from("profiles")
		.update({ subscription_status: newStatus })
		.eq("stripe_subscription_id", subscription.id);

	if (error) {
		console.error("[Webhook] Failed to update subscription status:", error);
		throw new Error("Failed to update subscription");
	}

	console.log(
		`[Webhook] Subscription ${subscription.id} updated → ${newStatus}`,
	);
}

async function handleSubscriptionDeleted(
	supabase: ReturnType<typeof createAdminClient>,
	subscription: Stripe.Subscription,
) {
	const { error } = await supabase
		.from("profiles")
		.update({ subscription_status: "cancelled", stripe_subscription_id: null })
		.eq("stripe_subscription_id", subscription.id);

	if (error) {
		console.error("[Webhook] Failed to cancel subscription:", error);
		throw new Error("Failed to cancel subscription");
	}

	console.log(`[Webhook] Subscription ${subscription.id} cancelled`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function markProcessed(
	supabase: ReturnType<typeof createAdminClient>,
	eventId: string,
) {
	const { error } = await supabase
		.from("processed_stripe_events")
		.insert({ event_id: eventId });

	if (error && error.code !== "23505") {
		// 23505 = unique_violation (race condition — safe to ignore)
		console.error("[Webhook] Failed to mark event as processed:", error);
	}
}

async function sendCreditEmail(
	supabase: ReturnType<typeof createAdminClient>,
	userId: string,
	amount: number,
	newBalance: number,
) {
	if (!resend) return;

	const { data: profile } = await supabase
		.from("profiles")
		.select("email, full_name")
		.eq("id", userId)
		.maybeSingle();

	if (!profile?.email) {
		console.error("[Webhook] No email found for user:", userId);
		return;
	}

	try {
		await resend.emails.send({
			from: "Echoflow <noreply@echoflow.app>",
			to: profile.email,
			subject: "Credits Added to Your Account",
			html: `
				<p>Hello ${profile.full_name || ""},</p>
				<p><strong>${amount} credits</strong> have been added to your account.</p>
				<p>New balance: <strong>${newBalance} credits</strong></p>
				<p>Credits never expire — use them at your own pace.</p>
				<p>Thank you for your support!</p>
			`,
		});
	} catch (error) {
		console.error("[Webhook] Error sending email:", error);
	}
}
