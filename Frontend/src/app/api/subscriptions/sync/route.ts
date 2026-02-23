import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const stripe =
	process.env.STRIPE_SECRET_KEY &&
	process.env.STRIPE_SECRET_KEY !== "sk_test_demo"
		? new Stripe(process.env.STRIPE_SECRET_KEY, {
				apiVersion: "2026-01-28.clover",
		  })
		: null;

/**
 * POST /api/subscriptions/sync
 *
 * Fallback activation called from the payment success page.
 * Verifies the Stripe Checkout session and activates the subscription
 * in DB immediately — in case the webhook fires with a delay.
 *
 * Also stores subscription_period_end so checkCredits() can honour
 * access until the billing period ends even after cancellation.
 *
 * Security:
 *   - Requires authenticated user session
 *   - Verifies session.metadata.user_id matches the current user
 *   - Only activates if session.mode=subscription
 *   - Uses service-role admin client for the DB write
 */
export async function POST(request: NextRequest) {
	const supabase = await createClient();

	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();

	if (authError || !user) {
		console.error("[SubSync] Unauthorized:", authError?.message);
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const body = await request.json().catch(() => ({}));
	const { session_id } = body as { session_id?: string };

	if (!session_id || typeof session_id !== "string") {
		return NextResponse.json({ error: "session_id required" }, { status: 400 });
	}

	// DEV MODE: return current DB status without hitting Stripe
	if (!stripe) {
		const { data: profile } = await supabase
			.from("profiles")
			.select("subscription_status")
			.eq("id", user.id)
			.maybeSingle();

		return NextResponse.json({
			activated: profile?.subscription_status === "active",
			devMode: true,
		});
	}

	try {
		// Retrieve checkout session from Stripe
		const session = await stripe.checkout.sessions.retrieve(session_id);
		console.log(
			`[SubSync] Session retrieved: id=${session.id}, mode=${session.mode}, payment_status=${session.payment_status}, user=${user.id}`,
		);

		// Security: session must belong to the authenticated user
		if (session.metadata?.user_id !== user.id) {
			console.warn(
				`[SubSync] user_id mismatch: expected ${user.id}, got ${session.metadata?.user_id}`,
			);
			return NextResponse.json(
				{ error: "Session does not belong to current user" },
				{ status: 403 },
			);
		}

		// Must be a subscription checkout
		if (session.mode !== "subscription") {
			console.warn(
				`[SubSync] Session mode is '${session.mode}', expected 'subscription'`,
			);
			return NextResponse.json(
				{ activated: false, reason: "Not a subscription session" },
				{ status: 200 },
			);
		}

		// Check DB first — webhook may have already activated it
		const { data: profile } = await supabase
			.from("profiles")
			.select("subscription_status")
			.eq("id", user.id)
			.maybeSingle();

		if (profile?.subscription_status === "active") {
			console.log(`[SubSync] Already active for user ${user.id}`);
			return NextResponse.json({ activated: true, alreadyActive: true });
		}

		// Get subscription ID from the session
		const subscriptionId =
			typeof session.subscription === "string"
				? session.subscription
				: (session.subscription as Stripe.Subscription | null)?.id ?? null;

		if (!subscriptionId) {
			console.error(`[SubSync] No subscription ID in session ${session.id}`);
			return NextResponse.json(
				{ activated: false, reason: "No subscription ID in session" },
				{ status: 200 },
			);
		}

		// Retrieve subscription object to get current_period_end
		let periodEnd: string | null = null;
		try {
			const sub = await stripe.subscriptions.retrieve(subscriptionId);
			const raw = sub as unknown as Record<string, unknown>;
			if (typeof raw.current_period_end === "number") {
				periodEnd = new Date(raw.current_period_end * 1000).toISOString();
			}
			console.log(
				`[SubSync] Subscription ${subscriptionId}: status=${sub.status}, period_end=${periodEnd}`,
			);
		} catch (e) {
			console.error(
				"[SubSync] Failed to retrieve subscription for period_end (non-fatal):",
				e,
			);
		}

		// Activate in DB using service role
		const admin = createAdminClient();
		const updates: Record<string, unknown> = {
			subscription_status: "active",
			stripe_subscription_id: subscriptionId,
			subscription_period_end: periodEnd,
		};
		if (session.customer && typeof session.customer === "string") {
			updates.stripe_customer_id = session.customer;
		}

		const { error: updateError } = await admin
			.from("profiles")
			.update(updates)
			.eq("id", user.id);

		if (updateError) {
			console.error(
				"[SubSync] Failed to activate subscription in DB:",
				updateError.code,
				updateError.message,
			);
			return NextResponse.json(
				{ error: "Failed to activate subscription", detail: updateError.message },
				{ status: 500 },
			);
		}

		console.log(
			`[SubSync] Activated: user=${user.id}, sub=${subscriptionId}, period_end=${periodEnd}`,
		);
		return NextResponse.json({ activated: true, periodEnd });
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		console.error("[SubSync] Unexpected error:", msg);
		return NextResponse.json(
			{ error: "Failed to sync subscription", detail: msg },
			{ status: 500 },
		);
	}
}
