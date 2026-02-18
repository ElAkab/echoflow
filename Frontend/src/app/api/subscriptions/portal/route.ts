import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const stripe = process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== "sk_test_demo"
	? new Stripe(process.env.STRIPE_SECRET_KEY, {
			apiVersion: "2026-01-28.clover",
	  })
	: null;

/**
 * POST /api/subscriptions/portal
 * Create a customer portal session
 */
export async function POST(request: NextRequest) {
	const supabase = await createClient();
	
	const { data: { user }, error: authError } = await supabase.auth.getUser();
	
	if (authError || !user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	// Dev mode - redirect to settings
	if (!stripe) {
		return NextResponse.json({
			devMode: true,
			url: "/settings",
		});
	}

	// Get user's Stripe customer ID
	const { data: userCredits } = await supabase
		.from("user_credits")
		.select("stripe_customer_id")
		.eq("user_id", user.id)
		.single();

	if (!userCredits?.stripe_customer_id) {
		return NextResponse.json(
			{ error: "No Stripe customer found" },
			{ status: 404 }
		);
	}

	try {
		const session = await stripe.billingPortal.sessions.create({
			customer: userCredits.stripe_customer_id,
			return_url: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/settings`,
		});

		return NextResponse.json({ url: session.url });
	} catch (error) {
		console.error("Error creating portal session:", error);
		return NextResponse.json(
			{ error: "Failed to create portal session" },
			{ status: 500 }
		);
	}
}