import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
	apiVersion: "2026-01-28.clover",
});

// Configuration des packs de crédits
const CREDIT_PACKS = {
	starter: {
		name: "Starter Pack",
		credits: 50,
		price: 500, // 5.00 EUR
		description: "50 Study Questions",
	},
	popular: {
		name: "Popular Pack",
		credits: 120,
		price: 1000, // 10.00 EUR (20% bonus)
		description: "120 Study Questions (20% bonus)",
	},
	pro: {
		name: "Pro Pack",
		credits: 300,
		price: 2000, // 20.00 EUR
		description: "300 Study Questions (best value)",
	},
};

export type CreditPackType = keyof typeof CREDIT_PACKS;

/**
 * POST /api/credits/checkout
 * Crée une session Stripe Checkout pour acheter des crédits
 */
export async function POST(request: NextRequest) {
	const supabase = await createClient();
	
	const { data: { user }, error: authError } = await supabase.auth.getUser();
	
	if (authError || !user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	
	try {
		const body = await request.json();
		const { pack } = body as { pack: CreditPackType };
		
		if (!pack || !CREDIT_PACKS[pack]) {
			return NextResponse.json(
				{ error: "Invalid credit pack" },
				{ status: 400 }
			);
		}
		
		const selectedPack = CREDIT_PACKS[pack];
		
		// Créer la session Stripe Checkout
		const session = await stripe.checkout.sessions.create({
			payment_method_types: ["card"],
			line_items: [
				{
					price_data: {
						currency: "eur",
						product_data: {
							name: selectedPack.name,
							description: selectedPack.description,
						},
						unit_amount: selectedPack.price,
					},
					quantity: 1,
				},
			],
			mode: "payment",
			success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/payment/cancel`,
			metadata: {
				user_id: user.id,
				credits: selectedPack.credits.toString(),
				pack_type: pack,
			},
			// Sauvegarder l'email pour le reçu
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
