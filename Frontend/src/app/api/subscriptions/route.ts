import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const stripe =
	process.env.STRIPE_SECRET_KEY &&
	process.env.STRIPE_SECRET_KEY !== "sk_test_demo"
		? new Stripe(process.env.STRIPE_SECRET_KEY, {
				apiVersion: "2026-01-28.clover",
		  })
		: null;

/**
 * GET /api/subscriptions
 * Returns subscription status + Stripe details (period end, cancel_at_period_end).
 */
export async function GET() {
	const supabase = await createClient();

	const {
		data: { user },
		error,
	} = await supabase.auth.getUser();

	if (error || !user) {
		return NextResponse.json({ subscription_status: "inactive" });
	}

	const { data: profile } = await supabase
		.from("profiles")
		.select("subscription_status, stripe_subscription_id")
		.eq("id", user.id)
		.maybeSingle();

	const status = profile?.subscription_status ?? "inactive";

	// Fetch live details from Stripe if we have a subscription ID
	let periodEnd: string | null = null;
	let cancelAtPeriodEnd = false;

	if (profile?.stripe_subscription_id && stripe) {
		try {
			const sub = await stripe.subscriptions.retrieve(
				profile.stripe_subscription_id,
			);
			// current_period_end exists at runtime; cast needed for newer API typedefs
			const raw = sub as unknown as Record<string, unknown>;
			if (typeof raw.current_period_end === "number") {
				periodEnd = new Date(raw.current_period_end * 1000).toISOString();
			}
			cancelAtPeriodEnd = (raw.cancel_at_period_end as boolean) ?? false;
		} catch {
			// Stripe fetch failed — return DB status only, not fatal
		}
	}

	return NextResponse.json({
		subscription_status: status,
		period_end: periodEnd,
		cancel_at_period_end: cancelAtPeriodEnd,
	});
}

/**
 * POST /api/subscriptions
 * Creates a Stripe Checkout session for the Pro monthly subscription.
 *
 * DEV MODE: activates subscription directly in DB when Stripe is not configured.
 */
export async function POST(_request: NextRequest) {
	const supabase = await createClient();

	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();

	if (authError || !user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	// DEV MODE: activate subscription directly without Stripe
	if (!stripe) {
		const { error: updateError } = await supabase
			.from("profiles")
			.update({ subscription_status: "active" })
			.eq("id", user.id);

		if (updateError) {
			console.error("[Subscriptions] Dev mode update failed:", updateError);
			return NextResponse.json(
				{ error: "Failed to activate dev subscription" },
				{ status: 500 },
			);
		}

		return NextResponse.json({
			devMode: true,
			message: "Pro subscription activated (dev mode)",
		});
	}

	// PRODUCTION: create Stripe Checkout session (mode: subscription)
	const priceId = process.env.STRIPE_PRO_PRICE_ID;
	if (!priceId) {
		console.error("[Subscriptions] STRIPE_PRO_PRICE_ID is not configured");
		return NextResponse.json(
			{ error: "Subscription plan not configured", code: "not_configured" },
			{ status: 503 },
		);
	}

	try {
		const session = await stripe.checkout.sessions.create({
			payment_method_types: ["card"],
			line_items: [{ price: priceId, quantity: 1 }],
			mode: "subscription",
			success_url: `${
				process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
			}/payment/success?subscription=true&session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: `${
				process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
			}/payment`,
			metadata: { user_id: user.id, type: "subscription" },
			customer_email: user.email,
		});

		return NextResponse.json({ sessionId: session.id, url: session.url });
	} catch (error) {
		console.error("[Subscriptions] Error creating Stripe session:", error);
		return NextResponse.json(
			{ error: "Failed to create checkout session" },
			{ status: 500 },
		);
	}
}

/**
 * DELETE /api/subscriptions
 * Cancels the active subscription at period end (user keeps access until renewal date).
 *
 * DEV MODE: sets status to 'cancelled' directly in DB.
 */
export async function DELETE() {
	const supabase = await createClient();

	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();

	if (authError || !user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	// DEV MODE
	if (!stripe) {
		await supabase
			.from("profiles")
			.update({ subscription_status: "cancelled", stripe_subscription_id: null })
			.eq("id", user.id);

		return NextResponse.json({
			devMode: true,
			message: "Subscription cancelled (dev mode)",
		});
	}

	const { data: profile } = await supabase
		.from("profiles")
		.select("stripe_subscription_id")
		.eq("id", user.id)
		.maybeSingle();

	if (!profile?.stripe_subscription_id) {
		return NextResponse.json(
			{ error: "No active subscription found" },
			{ status: 404 },
		);
	}

	try {
		// cancel_at_period_end: user keeps access until billing period ends
		await stripe.subscriptions.update(profile.stripe_subscription_id, {
			cancel_at_period_end: true,
		});

		return NextResponse.json({
			success: true,
			message: "Subscription will be cancelled at the end of the billing period",
		});
	} catch (error) {
		console.error("[Subscriptions] Error cancelling:", error);
		return NextResponse.json(
			{ error: "Failed to cancel subscription" },
			{ status: 500 },
		);
	}
}
