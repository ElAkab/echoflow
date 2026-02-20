/**
 * Credit System — Top-up model
 *
 * Three tiers (checked in priority order):
 *   1. BYOK  — user's own OpenRouter key → unlimited, no platform credits consumed
 *   2. Purchased — credits bought via top-up (never expire)
 *   3. Free quota — 20 quizzes/day, resets at midnight, uses fallback models
 */

import { createClient } from "@/lib/supabase/server";

export const DAILY_FREE_QUOTA = 20;

export type CreditSource = "byok" | "purchased" | "free_quota";

export interface CreditCheckResult {
	hasCredits: boolean;
	canUsePremium: boolean;
	source: CreditSource;
	premiumRemaining: number; // -1 = unlimited (BYOK)
	freeRemaining: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// checkCredits
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check credit availability and determine source.
 * Does NOT consume a credit — use consumeCredit() after a successful AI response.
 */
export async function checkCredits(userId: string): Promise<CreditCheckResult> {
	const supabase = await createClient();

	// 1. BYOK → unlimited
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

	// 2. Read credits + free quota from profiles
	const { data: profile } = await supabase
		.from("profiles")
		.select("credits, free_used_today, free_reset_at")
		.eq("id", userId)
		.maybeSingle();

	if (!profile) {
		// New user — no profile row yet, grant default free tier
		return {
			hasCredits: true,
			canUsePremium: false,
			source: "free_quota",
			premiumRemaining: 0,
			freeRemaining: DAILY_FREE_QUOTA,
		};
	}

	const credits = profile.credits ?? 0;

	// Mirror the daily-reset logic from the consume_credit SQL RPC:
	// if free_reset_at is from a previous calendar day, treat free_used_today as 0.
	const lastResetAt = profile.free_reset_at ? new Date(profile.free_reset_at) : null;
	const todayStart = new Date();
	todayStart.setHours(0, 0, 0, 0);
	const effectiveFreeUsed =
		!lastResetAt || lastResetAt < todayStart ? 0 : (profile.free_used_today ?? 0);
	const freeRemaining = Math.max(0, DAILY_FREE_QUOTA - effectiveFreeUsed);
	const source: CreditSource = credits > 0 ? "purchased" : "free_quota";

	return {
		hasCredits: credits > 0 || freeRemaining > 0,
		canUsePremium: credits > 0,
		source,
		premiumRemaining: credits,
		freeRemaining,
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// consumeCredit
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Atomically consume one credit after a successful AI response.
 * Only call this on the FIRST message of a session (subsequent turns are free).
 */
export async function consumeCredit(
	userId: string,
	preferPremium: boolean = true,
): Promise<{
	success: boolean;
	balance: number;
	message: string;
	source: CreditSource;
}> {
	const supabase = await createClient();

	// BYOK → no platform credits consumed
	const { data: byokKey } = await supabase
		.from("user_ai_keys")
		.select("id")
		.eq("user_id", userId)
		.maybeSingle();

	if (byokKey) {
		return {
			success: true,
			balance: -1,
			message: "Using BYOK — no credits consumed",
			source: "byok",
		};
	}

	const { data, error } = await supabase.rpc("consume_credit", {
		p_user_id: userId,
		p_is_premium_request: preferPremium,
	});

	if (error) {
		console.error("Error consuming credit:", error);
		return { success: false, balance: 0, message: error.message, source: "free_quota" };
	}

	const result = data?.[0] ?? data;
	const source: CreditSource = result?.used_premium ? "purchased" : "free_quota";

	return {
		success: result?.success ?? false,
		balance: result?.new_balance ?? 0,
		message: result?.message ?? "Credit consumed",
		source,
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// getCreditBalance
// ─────────────────────────────────────────────────────────────────────────────

export async function getCreditBalance(userId: string): Promise<{
	credits: number;
	freeUsed: number;
	freeLimit: number;
	hasPurchasedCredits: boolean;
}> {
	const supabase = await createClient();
	const { data } = await supabase
		.from("profiles")
		.select("credits, free_used_today")
		.eq("id", userId)
		.maybeSingle();

	return {
		credits: data?.credits ?? 0,
		freeUsed: data?.free_used_today ?? 0,
		freeLimit: DAILY_FREE_QUOTA,
		hasPurchasedCredits: (data?.credits ?? 0) > 0,
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// canUsePremiumModels
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if user has purchased credits or a BYOK key configured.
 * Used by OpenRouter routing to decide which models to attempt first.
 */
export async function canUsePremiumModels(userId: string): Promise<boolean> {
	const result = await checkCredits(userId);
	return result.canUsePremium;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function formatCredits(balance: number): string {
	if (balance < 0) return "∞";
	if (balance === 0) return "0";
	if (balance >= 1000) return `${Math.floor(balance / 1000)}k+`;
	return balance.toString();
}

/** @deprecated Use checkCredits instead */
export async function hasCredits(userId: string): Promise<boolean> {
	return (await checkCredits(userId)).hasCredits;
}

/** @deprecated Use getCreditBalance instead */
export async function getDailyUsage(userId: string): Promise<number> {
	const supabase = await createClient();
	const { data } = await supabase
		.from("profiles")
		.select("free_used_today")
		.eq("id", userId)
		.maybeSingle();
	return data?.free_used_today ?? 0;
}
