import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const stripe = process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== "sk_test_demo"
	? new Stripe(process.env.STRIPE_SECRET_KEY, {
			apiVersion: "2026-01-28.clover",
	  })
	: null;

const PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID || "";

/**
 * POST /api/subscriptions
 * Create a new Pro subscription
 */
export async function POST(request: NextRequest) {
	const supabase = await createClient();
	
	const { data: { user }, error: authError } = await supabase.auth.getUser();
	
	if (authError || !user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	// Dev mode simulation
	if (!stripe) {
		console.log("[DEV MODE] Simulating subscription creation");
		
		// Update user to pro in dev mode
		await supabase.rpc("update_subscription", {
			p_user_id: user.id,
			p_stripe_customer_id: "cus_dev_" + user.id,
			p_stripe_subscription_id: "sub_dev_" + user.id,
			p_status: "active",
			p_current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
		});

		return NextResponse.json({
			success: true,
			devMode: true,
			message: "Abonnement Pro activé en mode développement",
		});
	}

	try {
		// Get or create Stripe customer
		const { data: userCredits } = await supabase
			.from("user_credits")
			.select("stripe_customer_id")
			.eq("user_id", user.id)
			.maybeSingle();

		let customerId = userCredits?.stripe_customer_id;

		if (!customerId) {
			// Create new customer
			const customer = await stripe.customers.create({
				email: user.email,
				metadata: {
					user_id: user.id,
				},
			});
			customerId = customer.id;

			// Save customer ID
			await supabase.rpc("update_subscription", {
				p_user_id: user.id,
				p_stripe_customer_id: customerId,
				p_stripe_subscription_id: null,
				p_status: "inactive",
				p_current_period_end: null,
			});
		}

		// Create checkout session for subscription
		// Try to use existing price ID, otherwise create price dynamically
		let priceData: any;
		
		if (PRO_PRICE_ID && PRO_PRICE_ID.startsWith('price_')) {
			// Use existing price ID from Stripe
			priceData = { price: PRO_PRICE_ID, quantity: 1 };
		} else {
			// Create price dynamically (for development or if no price ID configured)
			priceData = {
				price_data: {
					currency: 'eur',
					product_data: {
						name: 'Pro Plan',
						description: '200 premium credits per month',
					},
					unit_amount: 700, // €7.00
					recurring: {
						interval: 'month',
					},
				},
				quantity: 1,
			};
		}
		
		const session = await stripe.checkout.sessions.create({
			customer: customerId,
			payment_method_types: ["card"],
			line_items: [priceData],
			mode: "subscription",
			success_url: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/payment/success?subscription=success`,
			cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/payment/cancel`,
			metadata: {
				user_id: user.id,
				type: "subscription",
			},
		});

		return NextResponse.json({
			sessionId: session.id,
			url: session.url,
		});
	} catch (error: any) {
		console.error("Error creating subscription:", error);
		return NextResponse.json(
			{ error: "Failed to create subscription", details: error.message },
			{ status: 500 }
		);
	}
}

/**
 * GET /api/subscriptions
 * Get current subscription status
 */
export async function GET(request: NextRequest) {
	const supabase = await createClient();
	
	const { data: { user }, error: authError } = await supabase.auth.getUser();
	
	if (authError || !user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const { data, error } = await supabase
			.from("user_credits")
			.select("subscription_tier, subscription_status, current_period_end, monthly_credits_used, monthly_credits_limit")
			.eq("user_id", user.id)
			.maybeSingle();

		if (error || !data) {
			return NextResponse.json({
				subscription_tier: "free",
				subscription_status: "inactive",
				current_period_end: null,
				monthly_credits_used: 0,
				monthly_credits_limit: 200,
			});
		}

		return NextResponse.json(data);
	} catch (error) {
		console.error("Error fetching subscription:", error);
		return NextResponse.json(
			{ error: "Failed to fetch subscription" },
			{ status: 500 }
		);
	}
}