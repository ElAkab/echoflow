import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DAILY_FREE_QUOTA = 20;

/**
 * GET /api/credits
 * Returns user credits, subscription status, and free quota
 */
export async function GET(request: NextRequest) {
	const supabase = await createClient();
	
	const { data: { user }, error: authError } = await supabase.auth.getUser();
	
	if (authError || !user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	
	try {
		// Get user credits and subscription info
		const { data: credits, error: creditsError } = await supabase
			.from("user_credits")
			.select("premium_balance, total_purchased, total_consumed, free_used_today, subscription_tier, subscription_status, monthly_credits_used, monthly_credits_limit")
			.eq("user_id", user.id)
			.maybeSingle();
		
		// Check BYOK
		const { data: byokKey } = await supabase
			.from("user_ai_keys")
			.select("id")
			.eq("user_id", user.id)
			.maybeSingle();
		
		// Calculate remaining free quota
		const freeUsed = credits?.free_used_today ?? 0;
		const freeRemaining = Math.max(0, DAILY_FREE_QUOTA - freeUsed);
		
		const isPro = credits?.subscription_status === "active";
		const monthlyRemaining = isPro ? (credits?.monthly_credits_limit ?? 200) - (credits?.monthly_credits_used ?? 0) : 0;
		
		// Total available premium credits (subscription + purchased)
		const totalPremiumAvailable = (credits?.premium_balance ?? 0) + monthlyRemaining;
		
		return NextResponse.json({
			// Premium credits
			premium_balance: credits?.premium_balance ?? 0,
			monthly_credits_used: credits?.monthly_credits_used ?? 0,
			monthly_credits_limit: credits?.monthly_credits_limit ?? 200,
			monthly_remaining: monthlyRemaining,
			total_premium_available: totalPremiumAvailable,
			
			// Free tier
			free_quota: DAILY_FREE_QUOTA,
			free_used: freeUsed,
			free_remaining: freeRemaining,
			
			// Subscription
			subscription_tier: credits?.subscription_tier ?? "free",
			subscription_status: credits?.subscription_status ?? "inactive",
			is_pro: isPro,
			
			// BYOK
			has_byok: !!byokKey,
			
			// Total usable now
			total_available: byokKey ? -1 : (totalPremiumAvailable + freeRemaining),
		});
	} catch (error) {
		console.error("Error fetching credits:", error);
		return NextResponse.json(
			{ error: "Failed to fetch credits" },
			{ status: 500 }
		);
	}
}