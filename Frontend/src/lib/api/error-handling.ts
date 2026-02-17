/**
 * Normalisation des erreurs API - Sécurité Production
 * 
 * Ce module garantit que les réponses d'erreur ne fuient pas d'informations
 * sensibles sur l'architecture interne (état BYOK, budget plateforme, etc.)
 * 
 * PRINCIPE DE SÉCURITÉ:
 * - Le client reçoit un message générique et un code d'erreur
 * - Les détails techniques sont logués côté serveur uniquement
 * - Les attaquants ne peuvent pas cartographier l'infrastructure via les erreurs
 */

import { NextResponse } from "next/server";

// Codes d'erreur publics (exposés au client)
export type PublicErrorCode =
	| "AUTH_REQUIRED"
	| "INVALID_INPUT"
	| "RATE_LIMIT_EXCEEDED"
	| "AI_SERVICE_UNAVAILABLE"
	| "CONTEXT_TOO_LONG"
	| "QUOTA_EXHAUSTED"
	| "CONFIGURATION_ERROR"
	| "INTERNAL_ERROR";

// Interface pour les réponses d'erreur standardisées
export interface StandardErrorResponse {
	success: false;
	error: {
		code: PublicErrorCode;
		message: string;
		// Pas de champ 'details' ici - les détails ne vont pas au client
	};
}

// Configuration des messages d'erreur publics
const ERROR_MESSAGES: Record<PublicErrorCode, string> = {
	AUTH_REQUIRED: "Please sign in to access this feature.",
	INVALID_INPUT: "The provided data is invalid. Please check and try again.",
	RATE_LIMIT_EXCEEDED: "Too many requests. Please wait a moment and try again.",
	AI_SERVICE_UNAVAILABLE: "AI service is temporarily unavailable. Please try again later.",
	CONTEXT_TOO_LONG: "The content is too long for processing. Please shorten it.",
	QUOTA_EXHAUSTED: "Your quota has been reached. Please upgrade or try again later.",
	CONFIGURATION_ERROR: "Service configuration issue. Please contact support.",
	INTERNAL_ERROR: "An unexpected error occurred. Please try again later.",
};

// HTTP status codes associés
const ERROR_STATUS_CODES: Record<PublicErrorCode, number> = {
	AUTH_REQUIRED: 401,
	INVALID_INPUT: 400,
	RATE_LIMIT_EXCEEDED: 429,
	AI_SERVICE_UNAVAILABLE: 503,
	CONTEXT_TOO_LONG: 400,
	QUOTA_EXHAUSTED: 429,
	CONFIGURATION_ERROR: 503,
	INTERNAL_ERROR: 500,
};

/**
 * Crée une réponse d'erreur standardisée et sécurisée
 * 
 * @param code - Code d'erreur public
 * @param customMessage - Message personnalisé (optionnel, sinon utilise le message par défaut)
 * @param serverDetails - Détails pour les logs serveur (jamais envoyés au client)
 */
export function createErrorResponse(
	code: PublicErrorCode,
	customMessage?: string,
	serverDetails?: Record<string, unknown>
): NextResponse<StandardErrorResponse> {
	// Logger les détails côté serveur si fournis
	if (serverDetails) {
		console.error(`[API Error] ${code}:`, {
			...serverDetails,
			timestamp: new Date().toISOString(),
		});
	}

	const message = customMessage || ERROR_MESSAGES[code];
	const status = ERROR_STATUS_CODES[code];

	return NextResponse.json(
		{
			success: false,
			error: {
				code,
				message,
			},
		},
		{ status }
	);
}

/**
 * Normalise les codes d'erreur OpenRouter internes en codes publics
 * 
 * Cette fonction masque les détails d'implémentation:
 * - "byok_or_upgrade_required" → "QUOTA_EXHAUSTED"
 * - "platform_budget_exhausted" → "AI_SERVICE_UNAVAILABLE"
 * - "ALL_MODELS_FAILED" → "AI_SERVICE_UNAVAILABLE"
 */
export function normalizeOpenRouterError(
	internalCode: string,
	serverContext?: Record<string, unknown>
): { code: PublicErrorCode; message?: string } {
	// Logger le mapping pour debugging
	if (serverContext) {
		console.log(`[Error Normalization] ${internalCode} → mapping`, serverContext);
	}

	switch (internalCode) {
		case "context_length_exceeded":
			return { code: "CONTEXT_TOO_LONG" };
		
		case "rate_limit_exceeded":
			return { code: "RATE_LIMIT_EXCEEDED" };
		
		case "insufficient_quota":
		case "byok_or_upgrade_required":
			return { code: "QUOTA_EXHAUSTED" };
		
		case "platform_budget_exhausted":
		case "ALL_MODELS_FAILED":
		case "invalid_model":
			return { code: "AI_SERVICE_UNAVAILABLE" };
		
		case "invalid_api_key":
			// Ne pas révéler que c'est une clé API invalide
			return { code: "AI_SERVICE_UNAVAILABLE" };
		
		default:
			return { code: "INTERNAL_ERROR" };
	}
}

/**
 * Wrapper pour les handlers d'API avec gestion d'erreur standardisée
 * 
 * Usage:
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   return withErrorHandling(async () => {
 *     // Votre logique ici
 *     return NextResponse.json({ success: true, data });
 *   }, request);
 * }
 * ```
 */
export async function withErrorHandling(
	handler: () => Promise<NextResponse>,
	request?: NextRequest
): Promise<NextResponse> {
	try {
		return await handler();
	} catch (error) {
		// Logger l'erreur complète côté serveur
		console.error("[API Exception]", {
			error: error instanceof Error ? error.message : "Unknown error",
			stack: error instanceof Error ? error.stack : undefined,
			path: request?.url,
			timestamp: new Date().toISOString(),
		});

		// Retourner une réponse générique au client
		return createErrorResponse("INTERNAL_ERROR");
	}
}

/**
 * Helper pour valider le JSON body sans fuiter d'informations
 */
export async function safeParseJson(
	request: NextRequest
): Promise<{ success: true; data: unknown } | { success: false; response: NextResponse }> {
	try {
		const data = await request.json();
		return { success: true, data };
	} catch {
		return {
			success: false,
			response: createErrorResponse("INVALID_INPUT", "Invalid JSON in request body"),
		};
	}
}
