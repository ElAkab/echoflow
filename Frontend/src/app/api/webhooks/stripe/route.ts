import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
	apiVersion: "2026-01-28.clover",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

/**
 * POST /api/webhooks/stripe
 * Reçoit les événements Stripe (paiement réussi, etc.)
 * Cette route doit être publique (pas d'authentification)
 */
export async function POST(request: NextRequest) {
	const payload = await request.text();
	const signature = request.headers.get("stripe-signature");
	
	if (!signature) {
		return NextResponse.json(
			{ error: "Missing stripe-signature header" },
			{ status: 400 }
		);
	}
	
	let event: Stripe.Event;
	
	try {
		event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
	} catch (err: any) {
		console.error("Webhook signature verification failed:", err.message);
		return NextResponse.json(
			{ error: `Webhook Error: ${err.message}` },
			{ status: 400 }
		);
	}
	
	// Gérer l'événement checkout.session.completed
	if (event.type === "checkout.session.completed") {
		const session = event.data.object as Stripe.Checkout.Session;
		
		// Vérifier que c'est bien un paiement réussi
		if (session.payment_status === "paid") {
			const userId = session.metadata?.user_id;
			const creditsStr = session.metadata?.credits;
			
			if (!userId || !creditsStr) {
				console.error("Missing metadata in checkout session:", session.id);
				return NextResponse.json(
					{ error: "Missing metadata" },
					{ status: 400 }
				);
			}
			
			const credits = parseInt(creditsStr, 10);
			
			if (isNaN(credits) || credits <= 0) {
				console.error("Invalid credits amount:", creditsStr);
				return NextResponse.json(
					{ error: "Invalid credits amount" },
					{ status: 400 }
				);
			}
			
			// Ajouter les crédits à l'utilisateur
			const supabase = await createClient();
			
			const { data, error } = await supabase.rpc("add_credits", {
				p_user_id: userId,
				p_amount: credits,
				p_metadata: {
					stripe_session_id: session.id,
					stripe_payment_intent: session.payment_intent,
					amount_total: session.amount_total,
					currency: session.currency,
				},
			});
			
			if (error) {
				console.error("Error adding credits:", error);
				return NextResponse.json(
					{ error: "Failed to add credits" },
					{ status: 500 }
				);
			}
			
			console.log(`Added ${credits} credits to user ${userId}. New balance:`, data?.[0]?.new_balance);
			
			return NextResponse.json({ 
				received: true,
				success: true,
				credits_added: credits,
			});
		}
	}
	
	// Autres événements à gérer éventuellement
	// - charge.refunded (remboursement)
	// - etc.
	
	return NextResponse.json({ received: true });
}

// Stripe needs the raw body - Next.js App Router handles this automatically
// No special config needed for route handlers
