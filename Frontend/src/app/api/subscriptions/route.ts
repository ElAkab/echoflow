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
 * Returns the current subscription status for the authenticated user.
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
		.select("subscription_status")
		.eq("id", user.id)
		.maybeSingle();

	return NextResponse.json({
		subscription_status: profile?.subscription_status ?? "inactive",
	});
}

/**
 * POST /api/subscriptions
 * Creates a Stripe Checkout session for the Pro monthly subscription.
 *
 * Requires STRIPE_PRO_PRICE_ID env var (recurring monthly price ID from Stripe dashboard).
 * DEV MODE: if STRIPE_SECRET_KEY is "sk_test_demo" or absent, activates subscription directly.
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
			{
				error: "Subscription plan not configured",
				code: "not_configured",
			},
			{ status: 503 },
		);
	}

	try {
		const session = await stripe.checkout.sessions.create({
			payment_method_types: ["card"],
			line_items: [{ price: priceId, quantity: 1 }],
			mode: "subscription",
			success_url: `${
				process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
			}/payment/success?subscription=true&session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: `${
				process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
			}/payment`,
			metadata: {
				user_id: user.id,
				type: "subscription",
			},
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
