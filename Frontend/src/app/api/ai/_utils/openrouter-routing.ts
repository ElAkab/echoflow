import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { decryptOpenRouterKey } from "@/lib/security/byok-crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkCredits, canUsePremiumModels } from "@/lib/credits";

// Default models (used by ALL users - renamed from PREMIUM_MODELS)
const DEFAULT_MODELS = [
	"openai/gpt-4o-mini", // Le standard équilibré
	"mistralai/mistral-7b-instruct", // La touche française, très efficace
	// "google/gemini-flash-1.5-8b", // Le moins cher et très rapide
	"anthropic/claude-3-haiku", // Le meilleur pour le texte fluide
	"meta-llama/llama-3.1-8b-instruct", // L'open-source robuste
	// "deepseek/deepseek-chat", // Le génie low-cost
];

// Fallback models (Free tier) - UPDATED with valid model IDs
const FALLBACK_MODELS = [
	"meta-llama/llama-3.3-70b-instruct:free",
	"qwen/qwen-2.5-72b-instruct:free",
	"google/gemma-2-9b-it:free",
];

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

type OpenRouterRole = "system" | "user" | "assistant" | "tool";

type OpenRouterModelErrorCode =
	| "context_length_exceeded"
	| "insufficient_quota"
	| "rate_limit_exceeded"
	| "invalid_model"
	| "invalid_api_key"
	| "user_not_found";

type OpenRouterPublicErrorCode =
	| "context_length_exceeded"
	| "insufficient_quota"
	| "rate_limit_exceeded"
	| "platform_budget_exhausted"
	| "byok_or_upgrade_required"
	| "ALL_MODELS_FAILED"
	| "credits_exhausted"
	| "invalid_api_key";

type KeySource = "platform" | "byok";

type UsageActionType = "QUIZ" | "HINT" | "CHAT";

export type OpenRouterMessage = {
	role: OpenRouterRole;
	content: string;
};

type OpenRouterRoutingSuccess = {
	ok: true;
	response: Response;
	model: string;
	keySource: KeySource;
	isPremiumModel: boolean;
};

type OpenRouterRoutingFailure = {
	ok: false;
	status: number;
	code: OpenRouterPublicErrorCode;
	error: string;
	details?: unknown;
};

export type OpenRouterRoutingResult =
	| OpenRouterRoutingSuccess
	| OpenRouterRoutingFailure;

type OpenRouterRoutingOptions = {
	supabase: SupabaseClient;
	userId: string;
	messages: OpenRouterMessage[];
	temperature?: number;
	maxTokens?: number;
	stream?: boolean;
	title?: string;
	actionType?: UsageActionType;
	preferPremium?: boolean;
};

type PlatformKeyResolution =
	| { key: string; misconfigured: false }
	| { key: null; misconfigured: true };

type KeyCandidate = {
	source: KeySource;
	apiKey: string;
};

type UserByokState = {
	hasByokRow: boolean;
	apiKey: string | null;
	last4: string | null;
	decryptionError: boolean;
};

type PlatformBudgetState = {
	hardBlocked: boolean;
	softLimitReached: boolean;
	limit: number | null;
	currentCount: number;
	userHardBlocked: boolean;
	userCurrentCount: number;
};

function toRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== "object") return null;
	return value as Record<string, unknown>;
}

function readStringValue(record: Record<string, unknown>, key: string): string {
	const value = record[key];
	if (typeof value === "string") return value;
	if (typeof value === "number") return String(value);
	return "";
}

function resolvePlatformKey(): PlatformKeyResolution & { keyLabel: string } {
	const generic = process.env.OPENROUTER_API_KEY;
	const dev = process.env.OPENROUTER_DEV_API_KEY;
	const prod = process.env.OPENROUTER_PROD_API_KEY;
	const nodeEnv = process.env.NODE_ENV || "development";

	if (nodeEnv === "production") {
		const key = prod || generic || null;
		if (!key || (dev && key === dev)) {
			return { key: null, misconfigured: true, keyLabel: "none" };
		}
		return { key, misconfigured: false, keyLabel: "PROD" };
	}

	// Development: prefer DEV key, fallback to PROD or generic
	const key = dev || prod || generic || null;
	const keyLabel = dev ? "DEV" : prod ? "PROD" : generic ? "GENERIC" : "none";
	if (!key) return { key: null, misconfigured: true, keyLabel };
	return { key, misconfigured: false, keyLabel };
}

async function validateOpenRouterApiKey(
	apiKey: string,
): Promise<{ valid: boolean; error?: string }> {
	try {
		// Make a lightweight request to validate the API key
		const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${apiKey}`,
			},
		});

		if (response.status === 401) {
			return { valid: false, error: "Invalid API key - authentication failed" };
		}

		if (!response.ok) {
			return {
				valid: false,
				error: `API validation failed: ${response.status}`,
			};
		}

		// Also check auth status by fetching user info (if available)
		try {
			const authResponse = await fetch(`${OPENROUTER_BASE_URL}/auth/key`, {
				method: "GET",
				headers: {
					Authorization: `Bearer ${apiKey}`,
				},
			});

			if (authResponse.ok) {
				const authData = await authResponse.json();
				console.log("[OpenRouter] Key validation - account status:", {
					label: authData.data?.label || "unknown",
					limit_remaining: authData.data?.limit_remaining,
					usage: authData.data?.usage,
				});
			}
		} catch (e) {
			// Non-critical, just log
			console.log("[OpenRouter] Could not fetch auth status:", e);
		}

		return { valid: true };
	} catch (error) {
		return { valid: false, error: `Network error during validation: ${error}` };
	}
}

function classifyOpenRouterError(
	errorData: unknown,
): OpenRouterModelErrorCode | null {
	const root = toRecord(errorData);
	const nestedError = root ? toRecord(root.error) : null;
	const candidate = nestedError || root;
	if (!candidate) return null;

	const message = (
		readStringValue(candidate, "message") || readStringValue(candidate, "code")
	).toLowerCase();
	const code = readStringValue(candidate, "code").toLowerCase();
	const type = readStringValue(candidate, "type").toLowerCase();
	const status = readStringValue(candidate, "status");

	if (
		(message.includes("context") && message.includes("length")) ||
		code === "context_length_exceeded" ||
		type === "context_length_exceeded"
	) {
		return "context_length_exceeded";
	}

	if (
		message.includes("quota") ||
		message.includes("insufficient") ||
		code === "insufficient_quota" ||
		type === "insufficient_quota"
	) {
		return "insufficient_quota";
	}

	if (
		message.includes("rate") ||
		message.includes("429") ||
		code === "429" ||
		status === "429"
	) {
		return "rate_limit_exceeded";
	}

	if (
		message.includes("invalid model") ||
		(message.includes("model") && message.includes("invalid")) ||
		code === "invalid_model"
	) {
		return "invalid_model";
	}

	// Check for "user not found" specifically (indicates invalid/revoked key)
	if (message.includes("user not found") || message.includes("user not")) {
		return "user_not_found";
	}

	if (
		message.includes("invalid api key") ||
		message.includes("unauthorized") ||
		code === "401" ||
		status === "401" ||
		code === "invalid_api_key"
	) {
		return "invalid_api_key";
	}

	return null;
}

async function getUserByokState(
	supabase: SupabaseClient,
	userId: string,
): Promise<UserByokState> {
	try {
		const { data, error } = await supabase
			.from("user_ai_keys")
			.select("encrypted_key, key_last4")
			.eq("user_id", userId)
			.maybeSingle();

		if (error) {
			return {
				hasByokRow: false,
				apiKey: null,
				last4: null,
				decryptionError: false,
			};
		}

		if (!data?.encrypted_key) {
			return {
				hasByokRow: false,
				apiKey: null,
				last4: null,
				decryptionError: false,
			};
		}

		try {
			return {
				hasByokRow: true,
				apiKey: decryptOpenRouterKey(data.encrypted_key),
				last4: data.key_last4 || null,
				decryptionError: false,
			};
		} catch (error) {
			return {
				hasByokRow: true,
				apiKey: null,
				last4: data.key_last4 || null,
				decryptionError: true,
			};
		}
	} catch (error) {
		return {
			hasByokRow: false,
			apiKey: null,
			last4: null,
			decryptionError: false,
		};
	}
}

async function callOpenRouterChatCompletion(
	candidate: KeyCandidate,
	model: string,
	options: OpenRouterRoutingOptions,
): Promise<Response> {
	const payload: Record<string, unknown> = {
		model,
		messages: options.messages,
		temperature: options.temperature ?? 0.7,
		stream: options.stream ?? true,
	};

	if (typeof options.maxTokens === "number") {
		payload.max_tokens = options.maxTokens;
	}

	// Debug: Log key format (first/last 4 chars only for security)
	const keyPreview = candidate.apiKey
		? `${candidate.apiKey.slice(0, 4)}...${candidate.apiKey.slice(-4)}`
		: "missing";
	console.log(
		`[OpenRouter] Making request with key: ${keyPreview}, source: ${candidate.source}`,
	);

	return fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${candidate.apiKey}`,
			"Content-Type": "application/json",
			"HTTP-Referer":
				process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
			"X-Title": options.title || "Echoflow",
		},
		body: JSON.stringify(payload),
	});
}

export async function routeOpenRouterRequest(
	options: OpenRouterRoutingOptions,
): Promise<OpenRouterRoutingResult> {
	const platformResolution = resolvePlatformKey();
	const byokState = await getUserByokState(options.supabase, options.userId);

	// Check if user has premium access and actual credits
	const canUsePremium = await canUsePremiumModels(options.userId);
	const creditsStatus = await checkCredits(options.userId);
	const hasAnyCredits = creditsStatus.hasCredits;
	const preferPremium = options.preferPremium !== false;

	console.log("[OpenRouter Routing]", {
		userId: options.userId,
		canUsePremium,
		hasAnyCredits,
		freeCredits: creditsStatus.freeRemaining,
		premiumCredits: creditsStatus.premiumRemaining,
		preferPremium,
		hasByok: !!byokState.apiKey,
		hasPlatformKey: !!platformResolution.key,
		platformKeyLabel: platformResolution.keyLabel,
	});

	// Validate platform key if we're going to use it
	if (platformResolution.key && !byokState.apiKey) {
		console.log(
			`[OpenRouter] Validating platform key (${platformResolution.keyLabel})...`,
		);
		const validation = await validateOpenRouterApiKey(platformResolution.key);
		if (!validation.valid) {
			console.error(
				`[OpenRouter] Platform key (${platformResolution.keyLabel}) validation failed:`,
				validation.error,
			);
			return {
				ok: false,
				status: 503,
				code: "ALL_MODELS_FAILED",
				error: `OpenRouter API key configuration error (${platformResolution.keyLabel}): ${validation.error}. Please contact support.`,
			};
		}
		console.log(
			`[OpenRouter] Platform key (${platformResolution.keyLabel}) is valid`,
		);
	}

	// Build key candidates
	const keyCandidates: KeyCandidate[] = [];

	if (platformResolution.key) {
		keyCandidates.push({ source: "platform", apiKey: platformResolution.key });
		console.log(
			`[OpenRouter] Using platform key: ${platformResolution.keyLabel}`,
		);
	}

	if (byokState.apiKey) {
		keyCandidates.push({ source: "byok", apiKey: byokState.apiKey });
		console.log("[OpenRouter] Using BYOK key");
	}

	if (keyCandidates.length === 0) {
		console.error("[OpenRouter] No API keys available");
		return {
			ok: false,
			status: 503,
			code: "byok_or_upgrade_required",
			error:
				"No AI key available. Add your OpenRouter API key or upgrade to continue.",
		};
	}

	// Determine models to try based on access level
	let modelsToTry: string[];
	let usingPremiumModels = false;

	if (byokState.apiKey) {
		// BYOK users can use any model
		modelsToTry = [...DEFAULT_MODELS, ...FALLBACK_MODELS];
		usingPremiumModels = true;
	} else {
		// ALL users (free and premium) try DEFAULT_MODELS first, then FALLBACK_MODELS
		modelsToTry = [...DEFAULT_MODELS, ...FALLBACK_MODELS];
		usingPremiumModels = canUsePremium;
	}

	console.log("[OpenRouter] Models to try:", modelsToTry);

	let lastError: unknown = null;
	let fallbackAttempted = false;

	for (const keyCandidate of keyCandidates) {
		for (const model of modelsToTry) {
			const isPremiumModel = DEFAULT_MODELS.includes(model);

			// Note: All users (free and premium) now have access to DEFAULT_MODELS
			// Premium users get priority through rate limits, but model access is the same

			console.log(
				`[OpenRouter] Trying ${model} with ${keyCandidate.source} key`,
			);

			try {
				const response = await callOpenRouterChatCompletion(
					keyCandidate,
					model,
					options,
				);

				if (response.ok) {
					console.log(`[OpenRouter] Success with ${model}`);

					// Record usage
					await recordUsageLog(
						options.userId,
						`${keyCandidate.source}:${model}`,
						options.actionType || "QUIZ",
					);

					return {
						ok: true,
						response,
						model,
						keySource: keyCandidate.source,
						isPremiumModel,
					};
				}

				// Log the error response
				const errorText = await response.text();
				console.error(`[OpenRouter] ${model} failed:`, {
					status: response.status,
					error: errorText,
				});

				let errorBody: unknown;
				try {
					errorBody = JSON.parse(errorText);
				} catch {
					errorBody = { raw: errorText };
				}

				const classified = classifyOpenRouterError(errorBody);
				lastError = errorBody;

				// Critical error - don't try other models
				if (classified === "context_length_exceeded") {
					return {
						ok: false,
						status: 400,
						code: "context_length_exceeded",
						error: "Context length exceeded for this model.",
						details: errorBody,
					};
				}

				// API key issue - don't try other models, give clear error
				if (
					classified === "user_not_found" ||
					classified === "invalid_api_key"
				) {
					console.error(`[OpenRouter] API key issue detected: ${classified}`);
					return {
						ok: false,
						status: 401,
						code: "invalid_api_key",
						error:
							"OpenRouter API key is invalid or revoked. Please check your OPENROUTER_DEV_API_KEY environment variable or add your own key in settings.",
						details: errorBody,
					};
				}

				// Mark that we attempted fallback models
				if (!isPremiumModel) {
					fallbackAttempted = true;
				}

				// Continue to next model
				continue;
			} catch (error) {
				console.error(`[OpenRouter] ${model} exception:`, error);
				lastError = error;
				continue;
			}
		}
	}

	// All models failed - determine appropriate error
	console.error("[OpenRouter] All models failed:", lastError);
	console.log(
		"[OpenRouter] Error decision - hasAnyCredits:",
		hasAnyCredits,
		"canUsePremium:",
		canUsePremium,
		"hasByok:",
		!!byokState.apiKey,
	);

	// If user has any credits (free or paid) but models still failed, it's a service issue
	if (hasAnyCredits || byokState.apiKey) {
		return {
			ok: false,
			status: 503,
			code: "ALL_MODELS_FAILED",
			error: "All AI models are currently unavailable. Please try again later.",
			details: lastError,
		};
	}

	// User has NO credits at all - suggest upgrading or buying credits
	return {
		ok: false,
		status: 403,
		code: "credits_exhausted",
		error: "Credits exhausted. Upgrade to Pro or buy credits to continue.",
		details: lastError,
	};
}

async function recordUsageLog(
	userId: string,
	modelUsed: string,
	actionType: UsageActionType,
): Promise<void> {
	try {
		const admin = createAdminClient();
		await admin.from("usage_logs").insert({
			user_id: userId,
			model_used: modelUsed,
			action_type: actionType,
		});
	} catch (error) {
		console.warn("Failed to record usage log:", error);
	}
}
