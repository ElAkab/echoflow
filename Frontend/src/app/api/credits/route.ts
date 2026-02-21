import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DAILY_FREE_QUOTA = 20;

/**
 * GET /api/credits
 * Returns user credit balance and free-quota status.
 */
export async function GET(_request: NextRequest) {
	const supabase = await createClient();

	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();

	if (authError || !user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const [{ data: profile }, { data: byokKey }] = await Promise.all([
			supabase
				.from("profiles")
				.select("credits, free_used_today, free_reset_at, subscription_status")
				.eq("id", user.id)
				.maybeSingle(),
			supabase
				.from("user_ai_keys")
				.select("id")
				.eq("user_id", user.id)
				.maybeSingle(),
		]);

		const rawCredits = profile?.credits ?? 0;
		const isSubscribed = profile?.subscription_status === "active";

		// Subscribers get unlimited premium access — no credit math needed
		if (isSubscribed) {
			return NextResponse.json({
				credits: rawCredits,
				has_credits: true,
				free_quota: DAILY_FREE_QUOTA,
				free_used: 0,
				free_remaining: DAILY_FREE_QUOTA,
				has_byok: !!byokKey,
				is_subscribed: true,
				total_available: -1,
			});
		}

		// Mirror the daily top-up + reset logic from the consume_credit SQL RPC.
		const lastResetAt = profile?.free_reset_at
			? new Date(profile.free_reset_at)
			: null;
		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);
		const isNewDay = !lastResetAt || lastResetAt < todayStart;

		// Daily top-up: if new day and credits < 20, effective balance is 20
		let credits = rawCredits;
		if (isNewDay && credits < DAILY_FREE_QUOTA) {
			credits = DAILY_FREE_QUOTA;
		}

		const effectiveFreeUsed = isNewDay ? 0 : (profile?.free_used_today ?? 0);
		const freeRemaining = Math.max(0, DAILY_FREE_QUOTA - effectiveFreeUsed);

		return NextResponse.json({
			// Purchased credits
			credits,
			has_credits: credits > 0,

			// Free daily quota
			free_quota: DAILY_FREE_QUOTA,
			free_used: effectiveFreeUsed,
			free_remaining: freeRemaining,

			// BYOK
			has_byok: !!byokKey,

			// Subscription
			is_subscribed: false,

			// Total usable now (-1 = unlimited with BYOK)
			total_available: byokKey ? -1 : credits + freeRemaining,
		});
	} catch (error) {
		console.error("Error fetching credits:", error);
		return NextResponse.json({ error: "Failed to fetch credits" }, { status: 500 });
	}
}
