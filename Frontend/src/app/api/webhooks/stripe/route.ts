import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
	apiVersion: "2026-01-28.clover",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
const resend = process.env.RESEND_API_KEY 
	? new Resend(process.env.RESEND_API_KEY)
	: null;

// Idempotency: Track processed events
const processedEvents = new Set<string>();

/**
 * POST /api/webhooks/stripe
 * Handles all Stripe webhook events for subscriptions and credit purchases
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

	// Idempotency check
	if (processedEvents.has(event.id)) {
		console.log(`Event ${event.id} already processed, skipping`);
		return NextResponse.json({ received: true, idempotent: true });
	}

	const supabase = await createClient();

	try {
		switch (event.type) {
			// Credit top-up (one-time purchase)
			case "checkout.session.completed": {
				const session = event.data.object as Stripe.Checkout.Session;
				
				// Only process if it's a credit purchase (has credits metadata)
				const credits = session.metadata?.credits;
				if (credits && session.payment_status === "paid") {
					const userId = session.metadata?.user_id;
					if (!userId) {
						console.error("Missing user_id in checkout session:", session.id);
						return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
					}

					const creditAmount = parseInt(credits, 10);
					
					// Add credits
					const { data, error } = await supabase.rpc("add_credits", {
						p_user_id: userId,
						p_amount: creditAmount,
						p_metadata: {
							stripe_session_id: session.id,
							stripe_payment_intent: session.payment_intent,
							amount_total: session.amount_total,
							currency: session.currency,
							pack_type: session.metadata?.pack_type || "topup",
						},
					});

					if (error) {
						console.error("Error adding credits:", error);
						return NextResponse.json(
							{ error: "Failed to add credits" },
							{ status: 500 }
						);
					}

					// Send confirmation email
					await sendEmail(userId, "credits_purchased", {
						credits: creditAmount,
						new_balance: data?.[0]?.new_balance || creditAmount,
					});

					console.log(`Added ${creditAmount} credits to user ${userId}`);
				}
				break;
			}

			// Subscription created
			case "customer.subscription.created": {
				const subscription = event.data.object as Stripe.Subscription;
				await handleSubscriptionUpdate(supabase, subscription);
				
				// Send welcome email
				const userId = await getUserIdFromCustomer(supabase, subscription.customer as string);
				if (userId) {
					await sendEmail(userId, "subscription_created", {});
				}
				break;
			}

			// Subscription updated (renewal, plan change)
			case "customer.subscription.updated": {
				const subscription = event.data.object as Stripe.Subscription;
				await handleSubscriptionUpdate(supabase, subscription);
				break;
			}

			// Subscription deleted (cancellation)
			case "customer.subscription.deleted": {
				const subscription = event.data.object as Stripe.Subscription;
				await handleSubscriptionCancellation(supabase, subscription);
				
				// Send cancellation email
				const userId = await getUserIdFromCustomer(supabase, subscription.customer as string);
				if (userId) {
					await sendEmail(userId, "subscription_cancelled", {});
				}
				break;
			}

			// Successful payment (for invoices)
			case "invoice.payment_succeeded": {
				const invoice = event.data.object as Stripe.Invoice;
				const subscriptionId = (invoice as any).subscription;
				if (subscriptionId) {
					console.log(`Payment succeeded for subscription: ${subscriptionId}`);
					
					// Send receipt email
					const userId = await getUserIdFromCustomer(supabase, invoice.customer as string);
					if (userId) {
						await sendEmail(userId, "payment_succeeded", {
							amount: invoice.amount_paid,
							invoice_url: invoice.hosted_invoice_url,
						});
					}
				}
				break;
			}

			// Failed payment
			case "invoice.payment_failed": {
				const invoice = event.data.object as Stripe.Invoice;
				const subscriptionId = (invoice as any).subscription;
				if (subscriptionId) {
					console.error(`Payment failed for subscription: ${subscriptionId}`);
					
					// Update subscription status to past_due
					const userId = await getUserIdFromCustomer(supabase, invoice.customer as string);
					if (userId) {
						await supabase.rpc("update_subscription", {
							p_user_id: userId,
							p_stripe_customer_id: invoice.customer as string,
							p_stripe_subscription_id: subscriptionId,
							p_status: "past_due",
							p_current_period_end: new Date((invoice as any).period_end * 1000).toISOString(),
						});
						
						// Send dunning email
						await sendEmail(userId, "payment_failed", {
							invoice_url: invoice.hosted_invoice_url,
						});
					}
				}
				break;
			}

			// Refund handling
			case "charge.refunded": {
				const charge = event.data.object as Stripe.Charge;
				console.log(`Charge refunded: ${charge.id}`);
				// Could implement credit rollback here if needed
				break;
			}

			default:
				console.log(`Unhandled event type: ${event.type}`);
		}

		// Mark event as processed
		processedEvents.add(event.id);
		
		// Cleanup old events (keep last 1000)
		if (processedEvents.size > 1000) {
			const iterator = processedEvents.values();
			for (let i = 0; i < 100; i++) {
				const oldEvent = iterator.next().value;
				if (oldEvent) processedEvents.delete(oldEvent);
			}
		}

		return NextResponse.json({ received: true, success: true });
	} catch (error) {
		console.error("Error processing webhook:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}

async function handleSubscriptionUpdate(
	supabase: any,
	subscription: Stripe.Subscription
) {
	const customerId = subscription.customer as string;
	const userId = await getUserIdFromCustomer(supabase, customerId);

	if (!userId) {
		console.error("No user found for customer:", customerId);
		return;
	}

	const status = subscription.status === "active" ? "active" : 
		subscription.status === "canceled" ? "canceled" : 
		subscription.status === "past_due" ? "past_due" : "inactive";

	const { error } = await supabase.rpc("update_subscription", {
		p_user_id: userId,
		p_stripe_customer_id: customerId,
		p_stripe_subscription_id: subscription.id,
		p_status: status,
		p_current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
	});

	if (error) {
		console.error("Error updating subscription:", error);
		throw error;
	}

	console.log(`Updated subscription for user ${userId}: ${status}`);
}

async function handleSubscriptionCancellation(
	supabase: any,
	subscription: Stripe.Subscription
) {
	const customerId = subscription.customer as string;
	const userId = await getUserIdFromCustomer(supabase, customerId);

	if (!userId) {
		console.error("No user found for customer:", customerId);
		return;
	}

	const { error } = await supabase.rpc("update_subscription", {
		p_user_id: userId,
		p_stripe_customer_id: customerId,
		p_stripe_subscription_id: null,
		p_status: "canceled",
		p_current_period_end: null,
	});

	if (error) {
		console.error("Error canceling subscription:", error);
		throw error;
	}

	console.log(`Canceled subscription for user ${userId}`);
}

async function getUserIdFromCustomer(
	supabase: any,
	customerId: string
): Promise<string | null> {
	const { data, error } = await supabase
		.from("user_credits")
		.select("user_id")
		.eq("stripe_customer_id", customerId)
		.single();

	if (error || !data) {
		return null;
	}

	return data.user_id;
}

async function sendEmail(
	userId: string,
	type: string,
	data: Record<string, any>
) {
	if (!resend) {
		console.log("Resend not configured, skipping email");
		return;
	}

	// Get user email from profiles
	const supabase = await createClient();
	const { data: profile } = await supabase
		.from("profiles")
		.select("email, full_name")
		.eq("id", userId)
		.single();

	if (!profile?.email) {
		console.error("No email found for user:", userId);
		return;
	}

	const emailTemplates: Record<string, () => { subject: string; html: string }> = {
		credits_purchased: () => ({
			subject: "Credits Added to Your Account",
			html: `<p>Hello ${profile.full_name || ""},</p>
				<p>${data.credits} credits have been added to your account.</p>
				<p>New balance: ${data.new_balance} credits</p>
				<p>Thank you for your trust!</p>`,
		}),
		subscription_created: () => ({
			subject: "Welcome to Pro Plan!",
			html: `<p>Hello ${profile.full_name || ""},</p>
				<p>Your Pro subscription is now active.</p>
				<p>You have access to 200 premium credits per month.</p>
				<p>Thank you for your trust!</p>`,
		}),
		subscription_cancelled: () => ({
			subject: "Cancellation Confirmation",
			html: `<p>Hello ${profile.full_name || ""},</p>
				<p>Your subscription has been canceled.</p>
				<p>Your remaining credits are still usable.</p>
				<p>We hope to see you again soon!</p>`,
		}),
		payment_succeeded: () => ({
			subject: "Payment Confirmation",
			html: `<p>Hello ${profile.full_name || ""},</p>
				<p>Your payment of ${data.amount / 100}€ has been received.</p>
				${data.invoice_url ? `<p><a href="${data.invoice_url}">View Invoice</a></p>` : ""}
				<p>Thank you!</p>`,
		}),
		payment_failed: () => ({
			subject: "Payment Issue",
			html: `<p>Hello ${profile.full_name || ""},</p>
				<p>Your payment could not be processed.</p>
				<p>Please update your payment information to continue enjoying the Pro plan.</p>
				${data.invoice_url ? `<p><a href="${data.invoice_url}">Update Payment</a></p>` : ""}
				<p>If the problem persists, contact us.</p>`,
		}),
	};

	const template = emailTemplates[type];
	if (!template) {
		console.log(`No email template for type: ${type}`);
		return;
	}

	const { subject, html } = template();

	try {
		await resend.emails.send({
			from: "Echoflow <noreply@echoflow.app>",
			to: profile.email,
			subject,
			html,
		});
		console.log(`Email sent: ${type} to ${profile.email}`);
	} catch (error) {
		console.error("Error sending email:", error);
	}
}