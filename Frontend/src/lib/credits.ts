/**
 * Credit System - Logic
 * 
 * Hybrid model: Subscription (Pro) + Top-up credits + Free tier
 * - Pro: €7/month = 200 premium credits/month
 * - Top-up: €3 = 30 credits (never expire)
 * - Free: 20 quizzes/day with fallback models
 */

import { createClient } from "@/lib/supabase/server";

const DAILY_FREE_QUOTA = 20;

export type CreditSource = "byok" | "subscription" | "purchased" | "free_quota";

interface CreditCheckResult {
	hasCredits: boolean;
	canUsePremium: boolean;
	source: CreditSource;
	premiumRemaining: number;
	freeRemaining: number;
}

/**
 * Check if user has credits available and determine source
 */
export async function checkCredits(userId: string): Promise<CreditCheckResult> {
	const supabase = await createClient();

	// 1. Check BYOK (unlimited)
	const { data: byokKey } = await supabase
		.from("user_ai_keys")
		.select("id")
		.eq("user_id", userId)
		.maybeSingle();

	if (byokKey) {
		return {
			hasCredits: true,
			canUsePremium: true,
			source: "byok",
			premiumRemaining: -1,
			freeRemaining: DAILY_FREE_QUOTA,
		};
	}

	// 2. Get user credits
	const { data: credits } = await supabase
		.from("user_credits")
		.select("premium_balance, subscription_status, monthly_credits_used, monthly_credits_limit, free_used_today, current_period_end")
		.eq("user_id", userId)
		.maybeSingle();

	if (!credits) {
		return {
			hasCredits: true, // New users get free tier
			canUsePremium: false,
			source: "free_quota",
			premiumRemaining: 0,
			freeRemaining: DAILY_FREE_QUOTA,
		};
	}

	// Check subscription validity
	const isProActive = credits.subscription_status === "active" && 
		(!credits.current_period_end || new Date(credits.current_period_end) > new Date());

	// Calculate monthly remaining
	const monthlyRemaining = isProActive 
		? (credits.monthly_credits_limit ?? 200) - (credits.monthly_credits_used ?? 0)
		: 0;

	// Total premium available (subscription + purchased)
	const totalPremium = (credits.premium_balance ?? 0) + Math.max(0, monthlyRemaining);

	// Calculate free remaining
	const freeRemaining = Math.max(0, DAILY_FREE_QUOTA - (credits.free_used_today ?? 0));

	// Determine source
	let source: CreditSource = "free_quota";
	if (totalPremium > 0) {
		source = isProActive && monthlyRemaining > 0 ? "subscription" : "purchased";
	}

	return {
		hasCredits: totalPremium > 0 || freeRemaining > 0,
		canUsePremium: totalPremium > 0,
		source,
		premiumRemaining: totalPremium,
		freeRemaining,
	};
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use checkCredits instead
 */
export async function hasCredits(userId: string): Promise<boolean> {
	const result = await checkCredits(userId);
	return result.hasCredits;
}

/**
 * Get detailed credit balance
 */
export async function getCreditBalance(userId: string): Promise<{
	premium: number;
	monthlyUsed: number;
	monthlyLimit: number;
	freeUsed: number;
	freeLimit: number;
	isPro: boolean;
}> {
	const supabase = await createClient();
	
	const { data } = await supabase
		.from("user_credits")
		.select("premium_balance, monthly_credits_used, monthly_credits_limit, free_used_today, subscription_status, current_period_end")
		.eq("user_id", userId)
		.maybeSingle();
	
	const isPro = data?.subscription_status === "active" &&
		(!data?.current_period_end || new Date(data.current_period_end) > new Date());
	
	return {
		premium: data?.premium_balance ?? 0,
		monthlyUsed: data?.monthly_credits_used ?? 0,
		monthlyLimit: data?.monthly_credits_limit ?? 200,
		freeUsed: data?.free_used_today ?? 0,
		freeLimit: DAILY_FREE_QUOTA,
		isPro,
	};
}

/**
 * Consume a credit for quiz generation
 * Returns success status and source of credit used
 */
export async function consumeCredit(
	userId: string,
	preferPremium: boolean = true
): Promise<{
	success: boolean;
	balance: number;
	message: string;
	source: CreditSource;
}> {
	const supabase = await createClient();

	// Check BYOK first
	const { data: byokKey } = await supabase
		.from("user_ai_keys")
		.select("id")
		.eq("user_id", userId)
		.maybeSingle();

	if (byokKey) {
		return {
			success: true,
			balance: -1,
			message: "Using BYOK - no credits consumed",
			source: "byok",
		};
	}

	// Use RPC to consume credit atomically
	const { data, error } = await supabase.rpc("consume_credit", {
		p_user_id: userId,
		p_is_premium_request: preferPremium,
	});

	if (error) {
		console.error("Error consuming credit:", error);
		return {
			success: false,
			balance: 0,
			message: error.message,
			source: "free_quota",
		};
	}

	const result = data?.[0] || data;
	
	// Determine source from result
	let source: CreditSource = "free_quota";
	if (result.used_premium) {
		// Check if it came from subscription or purchased credits
		const balance = await getCreditBalance(userId);
		source = balance.isPro && balance.monthlyUsed <= balance.monthlyLimit 
			? "subscription" 
			: "purchased";
	}

	return {
		success: result.success || false,
		balance: result.new_premium_balance || 0,
		message: result.message || "Credit consumed",
		source,
	};
}

/**
 * Format credits for display
 */
export function formatCredits(balance: number): string {
	if (balance < 0) {
		return "∞";
	}
	if (balance === 0) {
		return "0";
	}
	if (balance >= 1000) {
		return `${Math.floor(balance / 1000)}k+`;
	}
	return balance.toString();
}

/**
 * Check if user can use premium models
 */
export async function canUsePremiumModels(userId: string): Promise<boolean> {
	const result = await checkCredits(userId);
	return result.canUsePremium;
}

/**
 * Get daily usage count (legacy function for backward compatibility)
 * @deprecated Use checkCredits or getCreditBalance instead
 */
export async function getDailyUsage(userId: string): Promise<number> {
	const supabase = await createClient();
	
	const { data } = await supabase
		.from("user_credits")
		.select("free_used_today")
		.eq("user_id", userId)
		.maybeSingle();
	
	return data?.free_used_today ?? 0;
}
