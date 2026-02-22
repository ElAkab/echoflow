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

export type CreditSource = "byok" | "subscription" | "purchased" | "free_quota";

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

	// 2. Read credits + free quota + subscription status from profiles
	const { data: profile } = await supabase
		.from("profiles")
		.select("credits, free_used_today, free_reset_at, subscription_status")
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

	// 2b. Active subscriber → unlimited premium (no credit deduction)
	if (profile.subscription_status === "active") {
		return {
			hasCredits: true,
			canUsePremium: true,
			source: "subscription",
			premiumRemaining: -1,
			freeRemaining: DAILY_FREE_QUOTA,
		};
	}

	let credits = profile.credits ?? 0;

	// Mirror the daily top-up + reset logic from the consume_credit SQL RPC.
	const lastResetAt = profile.free_reset_at ? new Date(profile.free_reset_at) : null;
	const todayStart = new Date();
	todayStart.setHours(0, 0, 0, 0);
	const isNewDay = !lastResetAt || lastResetAt < todayStart;

	if (isNewDay && credits < DAILY_FREE_QUOTA) {
		// Daily top-up: user will receive at least 20 credits when they next use the app
		credits = DAILY_FREE_QUOTA;
	}

	const effectiveFreeUsed = isNewDay ? 0 : (profile.free_used_today ?? 0);
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
 * Consume one credit after a successful AI response.
 * Only call this on the FIRST message of a session (subsequent turns are free).
 *
 * Implemented entirely in TypeScript — no SQL RPC required.
 * Logic mirrors the consume_credit SQL function:
 *   1. BYOK → skip (no credits consumed)
 *   2. Subscription → skip (unlimited)
 *   3. New day → reset free counter + daily top-up if credits < quota
 *   4. Prefer premium credits first, fall back to free quota
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

	// 1. BYOK → no platform credits consumed
	const { data: byokKey } = await supabase
		.from("user_ai_keys")
		.select("id")
		.eq("user_id", userId)
		.maybeSingle();

	if (byokKey) {
		return { success: true, balance: -1, message: "Using BYOK — no credits consumed", source: "byok" };
	}

	// 2. Read profile
	const { data: profile, error: fetchError } = await supabase
		.from("profiles")
		.select("credits, free_used_today, free_reset_at, subscription_status")
		.eq("id", userId)
		.maybeSingle();

	if (fetchError || !profile) {
		console.error("consumeCredit: failed to fetch profile", fetchError);
		return { success: false, balance: 0, message: "Profile not found", source: "free_quota" };
	}

	// 3. Subscription → no credits consumed
	if (profile.subscription_status === "active") {
		return { success: true, balance: -1, message: "Subscription active — no credits consumed", source: "subscription" };
	}

	// 4. Compute effective state with daily reset + top-up
	const lastResetAt = profile.free_reset_at ? new Date(profile.free_reset_at) : null;
	const todayStart = new Date();
	todayStart.setHours(0, 0, 0, 0);
	const isNewDay = !lastResetAt || lastResetAt < todayStart;

	let credits = profile.credits ?? 0;
	let freeUsedToday = isNewDay ? 0 : (profile.free_used_today ?? 0);

	// Daily top-up: if new day and balance below quota, restore to quota
	const topUpApplied = isNewDay && credits < DAILY_FREE_QUOTA;
	if (topUpApplied) {
		credits = DAILY_FREE_QUOTA;
	}

	// 5. Try to consume
	const updates: Record<string, unknown> = {};

	if (isNewDay) {
		updates.free_used_today = 0;
		updates.free_reset_at = new Date().toISOString();
		if (topUpApplied) {
			updates.credits = credits; // persist top-up
		}
	}

	if (preferPremium && credits > 0) {
		// Consume a purchased credit
		updates.credits = credits - 1;
		const { error } = await supabase.from("profiles").update(updates).eq("id", userId);
		if (error) {
			console.error("consumeCredit: failed to update credits", error);
			return { success: false, balance: 0, message: error.message, source: "purchased" };
		}
		return { success: true, balance: credits - 1, message: "Premium credit consumed", source: "purchased" };
	}

	if (freeUsedToday < DAILY_FREE_QUOTA) {
		// Consume a free quota slot
		updates.free_used_today = freeUsedToday + 1;
		const { error } = await supabase.from("profiles").update(updates).eq("id", userId);
		if (error) {
			console.error("consumeCredit: failed to update free quota", error);
			return { success: false, balance: 0, message: error.message, source: "free_quota" };
		}
		return { success: true, balance: credits, message: "Free credit consumed", source: "free_quota" };
	}

	return { success: false, balance: 0, message: "No credits available", source: "free_quota" };
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
