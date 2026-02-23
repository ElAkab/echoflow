import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
	sendTopUpEmail,
	sendSubscriptionWelcomeEmail,
	sendSubscriptionCancelledEmail,
} from "@/lib/email/send";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
	apiVersion: "2026-01-28.clover",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

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
		console.error("[Webhook] Signature verification failed:", message);
		return NextResponse.json(
			{ error: `Webhook Error: ${message}` },
			{ status: 400 },
		);
	}

	console.log(`[Webhook] Received event: ${event.type} (${event.id})`);
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
			case "checkout.session.completed": {
				const session = event.data.object as Stripe.Checkout.Session;
				console.log(
					`[Webhook] checkout.session.completed: mode=${session.mode}, payment_status=${session.payment_status}, session=${session.id}`,
				);

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

			case "customer.subscription.updated": {
				const subscription = event.data.object as Stripe.Subscription;
				console.log(
					`[Webhook] customer.subscription.updated: sub=${subscription.id}, status=${subscription.status}`,
				);
				await handleSubscriptionUpdated(supabase, subscription);
				break;
			}

			case "customer.subscription.deleted": {
				const subscription = event.data.object as Stripe.Subscription;
				console.log(
					`[Webhook] customer.subscription.deleted: sub=${subscription.id}`,
				);
				await handleSubscriptionDeleted(supabase, subscription);
				break;
			}

			default:
				console.log(`[Webhook] Unhandled event type: ${event.type}`);
		}

		// ── 4. Mark event as processed ──────────────────────────────────────
		await markProcessed(supabase, event.id);
		console.log(`[Webhook] Event ${event.id} processed successfully`);
		return NextResponse.json({ received: true, success: true });
	} catch (error) {
		console.error("[Webhook] Unexpected error processing event:", error);
		// Do NOT mark as processed — Stripe will retry
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Extract current_period_end from a Stripe Subscription (runtime field, absent from newer typedefs) */
function getPeriodEnd(subscription: Stripe.Subscription): string | null {
	const raw = subscription as unknown as Record<string, unknown>;
	if (typeof raw.current_period_end === "number") {
		return new Date(raw.current_period_end * 1000).toISOString();
	}
	return null;
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

	console.log(
		`[Webhook] Top-up: user=${user_id}, amount=${creditAmount}, session=${session.id}`,
	);

	const { data: profileData, error: fetchError } = await supabase
		.from("profiles")
		.select("credits, email, full_name")
		.eq("id", user_id)
		.maybeSingle();

	if (fetchError) {
		console.error("[Webhook] Failed to fetch profile for top-up:", fetchError);
		throw new Error("Failed to fetch profile");
	}

	if (!profileData) {
		console.error(`[Webhook] Profile not found for user ${user_id}`);
		throw new Error("Profile not found");
	}

	const currentCredits = profileData.credits ?? 0;
	const newBalance = currentCredits + creditAmount;

	const updates: Record<string, unknown> = { credits: newBalance };
	if (session.customer && typeof session.customer === "string") {
		updates.stripe_customer_id = session.customer;
	}

	const { error: updateError } = await supabase
		.from("profiles")
		.update(updates)
		.eq("id", user_id);

	if (updateError) {
		console.error("[Webhook] Failed to add credits:", updateError);
		throw new Error("Failed to add credits");
	}

	console.log(
		`[Webhook] Top-up done: +${creditAmount} → user ${user_id}. Balance: ${currentCredits} → ${newBalance}`,
	);

	if (profileData.email) {
		sendTopUpEmail(
			profileData.email,
			profileData.full_name,
			creditAmount,
			newBalance,
		).catch((e) =>
			console.error("[Webhook] Failed to send top-up email:", e),
		);
	}
}

async function handleSubscriptionCheckoutCompleted(
	supabase: ReturnType<typeof createAdminClient>,
	session: Stripe.Checkout.Session,
) {
	const metaParse = SubscriptionMetadataSchema.safeParse(session.metadata);

	if (!metaParse.success) {
		console.log(
			`[Webhook] Skipping subscription session without valid metadata ${session.id}:`,
			metaParse.error.issues,
		);
		return;
	}

	const { user_id } = metaParse.data;

	const subscriptionId =
		typeof session.subscription === "string"
			? session.subscription
			: (session.subscription as Stripe.Subscription | null)?.id ?? null;

	if (!subscriptionId) {
		console.error(
			`[Webhook] No subscription ID found in session ${session.id}`,
		);
		throw new Error("No subscription ID in checkout session");
	}

	// Retrieve subscription to get current_period_end
	let periodEnd: string | null = null;
	try {
		const sub = await stripe.subscriptions.retrieve(subscriptionId);
		periodEnd = getPeriodEnd(sub);
		console.log(
			`[Webhook] Subscription ${subscriptionId}: period_end=${periodEnd}`,
		);
	} catch (e) {
		console.error(
			"[Webhook] Failed to retrieve subscription for period_end (non-fatal):",
			e,
		);
	}

	const updates: Record<string, unknown> = {
		subscription_status: "active",
		stripe_subscription_id: subscriptionId,
		subscription_period_end: periodEnd,
	};
	if (session.customer && typeof session.customer === "string") {
		updates.stripe_customer_id = session.customer;
	}

	const { error } = await supabase
		.from("profiles")
		.update(updates)
		.eq("id", user_id);

	if (error) {
		console.error(
			"[Webhook] Failed to activate subscription in DB:",
			error.code,
			error.message,
		);
		throw new Error("Failed to activate subscription");
	}

	console.log(
		`[Webhook] Subscription activated: user=${user_id}, sub=${subscriptionId}, period_end=${periodEnd}`,
	);

	const { data: profile } = await supabase
		.from("profiles")
		.select("email, full_name")
		.eq("id", user_id)
		.maybeSingle();

	if (profile?.email) {
		sendSubscriptionWelcomeEmail(profile.email, profile.full_name).catch(
			(e) => console.error("[Webhook] Failed to send welcome email:", e),
		);
	}
}

async function handleSubscriptionUpdated(
	supabase: ReturnType<typeof createAdminClient>,
	subscription: Stripe.Subscription,
) {
	const statusMap: Record<string, string> = {
		active: "active",
		past_due: "past_due",
		canceled: "cancelled",
		unpaid: "past_due",
		trialing: "active",
	};

	const newStatus = statusMap[subscription.status] ?? "inactive";
	const periodEnd = getPeriodEnd(subscription);

	console.log(
		`[Webhook] Subscription update: sub=${subscription.id}, stripe_status=${subscription.status} → db_status=${newStatus}, period_end=${periodEnd}`,
	);

	const { error } = await supabase
		.from("profiles")
		.update({
			subscription_status: newStatus,
			subscription_period_end: periodEnd,
		})
		.eq("stripe_subscription_id", subscription.id);

	if (error) {
		console.error(
			"[Webhook] Failed to update subscription status:",
			error.code,
			error.message,
		);
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
	// Keep period_end so checkCredits() can honour access until billing period ends
	const periodEnd = getPeriodEnd(subscription);

	console.log(
		`[Webhook] Subscription deleted: sub=${subscription.id}, period_end=${periodEnd}`,
	);

	// Fetch email BEFORE clearing stripe_subscription_id
	const { data: profile } = await supabase
		.from("profiles")
		.select("email, full_name")
		.eq("stripe_subscription_id", subscription.id)
		.maybeSingle();

	const { error } = await supabase
		.from("profiles")
		.update({
			subscription_status: "cancelled",
			stripe_subscription_id: null,
			subscription_period_end: periodEnd, // preserved — not nulled
		})
		.eq("stripe_subscription_id", subscription.id);

	if (error) {
		console.error(
			"[Webhook] Failed to cancel subscription:",
			error.code,
			error.message,
		);
		throw new Error("Failed to cancel subscription");
	}

	console.log(`[Webhook] Subscription ${subscription.id} cancelled`);

	if (profile?.email) {
		sendSubscriptionCancelledEmail(profile.email, profile.full_name).catch(
			(e) =>
				console.error("[Webhook] Failed to send cancellation email:", e),
		);
	}
}

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
