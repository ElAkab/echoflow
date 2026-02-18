import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const stripe = process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== "sk_test_demo"
	? new Stripe(process.env.STRIPE_SECRET_KEY, {
			apiVersion: "2026-01-28.clover",
	  })
	: null;

/**
 * POST /api/subscriptions/cancel
 * Cancel subscription at period end
 */
export async function POST(request: NextRequest) {
	const supabase = await createClient();
	
	const { data: { user }, error: authError } = await supabase.auth.getUser();
	
	if (authError || !user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	// Get user's subscription
	const { data: userCredits } = await supabase
		.from("user_credits")
		.select("stripe_subscription_id, stripe_customer_id, subscription_status")
		.eq("user_id", user.id)
		.single();

	if (!userCredits?.stripe_subscription_id) {
		return NextResponse.json(
			{ error: "No active subscription found" },
			{ status: 404 }
		);
	}

	// Dev mode simulation
	if (!stripe) {
		console.log("[DEV MODE] Simulating subscription cancellation");
		
		await supabase.rpc("update_subscription", {
			p_user_id: user.id,
			p_stripe_customer_id: userCredits.stripe_customer_id,
			p_stripe_subscription_id: null,
			p_status: "canceled",
			p_current_period_end: null,
		});

		return NextResponse.json({
			success: true,
			devMode: true,
			message: "Abonnement annulé en mode développement",
		});
	}

	try {
		// Cancel subscription at period end
		await stripe.subscriptions.update(userCredits.stripe_subscription_id, {
			cancel_at_period_end: true,
		});

		return NextResponse.json({
			success: true,
			message: "Subscription will be canceled at the end of the current period",
		});
	} catch (error) {
		console.error("Error canceling subscription:", error);
		return NextResponse.json(
			{ error: "Failed to cancel subscription" },
			{ status: 500 }
		);
	}
}
