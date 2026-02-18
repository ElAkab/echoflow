import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const stripe = process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== "sk_test_demo"
	? new Stripe(process.env.STRIPE_SECRET_KEY, {
			apiVersion: "2026-01-28.clover",
	  })
	: null;

// Top-up credits: 3€ for 30 credits
const TOP_UP_CONFIG = {
	credits: 30,
	price: 300, // 3.00 EUR
};

/**
 * POST /api/credits/checkout
 * Create checkout session for credits top-up (3€ = 30 credits)
 */
export async function POST(request: NextRequest) {
	const supabase = await createClient();
	
	const { data: { user }, error: authError } = await supabase.auth.getUser();
	
	if (authError || !user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	
	// DEV MODE: Add credits directly
	if (!stripe) {
		console.log("[DEV MODE] Adding credits directly");
		
		const { data, error } = await supabase.rpc("add_credits", {
			p_user_id: user.id,
			p_amount: TOP_UP_CONFIG.credits,
			p_metadata: {
				mode: "development",
				amount_eur: TOP_UP_CONFIG.price / 100,
				simulated: true,
			},
		});
		
		if (error) {
			console.error("Error adding credits:", error);
			return NextResponse.json({ error: "Failed to add credits" }, { status: 500 });
		}
		
		return NextResponse.json({
			success: true,
			devMode: true,
			credits: TOP_UP_CONFIG.credits,
			newBalance: data?.[0]?.new_balance,
			redirectUrl: "/payment/success?dev_mode=true",
		});
	}
	
	// PRODUCTION: Create Stripe checkout session
	try {
		const session = await stripe.checkout.sessions.create({
			payment_method_types: ["card"],
			line_items: [
				{
					price_data: {
						currency: "eur",
						product_data: {
							name: "30 Crédits Premium",
							description: "30 questions avec modèles premium (GPT-4o, Mistral 7B)",
						},
						unit_amount: TOP_UP_CONFIG.price,
					},
					quantity: 1,
				},
			],
			mode: "payment",
			success_url: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/payment/cancel`,
			metadata: {
				user_id: user.id,
				credits: TOP_UP_CONFIG.credits.toString(),
				type: "topup",
			},
			customer_email: user.email,
		});
		
		return NextResponse.json({
			sessionId: session.id,
			url: session.url,
		});
	} catch (error) {
		console.error("Error creating checkout session:", error);
		return NextResponse.json(
			{ error: "Failed to create checkout session" },
			{ status: 500 }
		);
	}
}
