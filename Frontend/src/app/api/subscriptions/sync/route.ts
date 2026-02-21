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
 * Verifies the Stripe Checkout session client-side and activates the
 * subscription in DB immediately — in case the webhook fires with a delay.
 *
 * Security:
 *   - Requires authenticated user session
 *   - Verifies session.metadata.user_id matches the current user
 *   - Only activates if session.mode=subscription AND payment_status=paid
 *   - Uses service-role admin client for the DB write
 */
export async function POST(request: NextRequest) {
	const supabase = await createClient();

	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();

	if (authError || !user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const body = await request.json().catch(() => ({}));
	const { session_id } = body as { session_id?: string };

	if (!session_id || typeof session_id !== "string") {
		return NextResponse.json({ error: "session_id required" }, { status: 400 });
	}

	// DEV MODE: just return the current DB status
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
		const session = await stripe.checkout.sessions.retrieve(session_id);

		// Security: verify this session belongs to the authenticated user
		if (session.metadata?.user_id !== user.id) {
			console.warn(
				`[Sync] session ${session_id} user_id mismatch: expected ${user.id}, got ${session.metadata?.user_id}`,
			);
			return NextResponse.json(
				{ error: "Session does not belong to current user" },
				{ status: 403 },
			);
		}

		// Only activate for completed subscription sessions
		if (session.mode !== "subscription" || session.payment_status !== "paid") {
			return NextResponse.json(
				{ activated: false, reason: "Session not a completed subscription" },
				{ status: 200 },
			);
		}

		// Check DB first — webhook may have already processed it
		const { data: profile } = await supabase
			.from("profiles")
			.select("subscription_status")
			.eq("id", user.id)
			.maybeSingle();

		if (profile?.subscription_status === "active") {
			return NextResponse.json({ activated: true, alreadyActive: true });
		}

		const subscriptionId =
			typeof session.subscription === "string"
				? session.subscription
				: (session.subscription as { id?: string } | null)?.id ?? null;

		const admin = createAdminClient();
		const { error: updateError } = await admin
			.from("profiles")
			.update({
				subscription_status: "active",
				stripe_subscription_id: subscriptionId,
				...(session.customer && typeof session.customer === "string"
					? { stripe_customer_id: session.customer }
					: {}),
			})
			.eq("id", user.id);

		if (updateError) {
			console.error("[Sync] Failed to activate subscription:", updateError);
			return NextResponse.json(
				{ error: "Failed to activate subscription" },
				{ status: 500 },
			);
		}

		console.log(
			`[Sync] Subscription activated: user ${user.id}, sub ${subscriptionId}`,
		);
		return NextResponse.json({ activated: true });
	} catch (error) {
		console.error("[Sync] Error verifying session:", error);
		return NextResponse.json(
			{ error: "Failed to sync subscription" },
			{ status: 500 },
		);
	}
}
