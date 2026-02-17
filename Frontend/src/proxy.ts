/**
 * Next.js Middleware - Combined Auth + Rate Limiting
 *
 * Ce middleware combine deux responsabilités critiques:
 * 1. Authentification (Supabase SSR) - Protection des routes
 * 2. Rate Limiting (Upstash Redis) - Protection contre les abus
 *
 * Ordre d'exécution:
 * 1. Rate limiting d'abord (même pour les routes non protégées)
 * 2. Puis vérification authentification
 *
 * Cela permet de:
 * - Protéger contre le brute force sur /auth/login
 * - Limiter les abus API même sans authentification
 * - Maintenir une session utilisateur cohérente
 */

import { createServerClient } from "@supabase/ssr";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse, type NextRequest } from "next/server";

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION RATE LIMITING
// ═══════════════════════════════════════════════════════════════════════════════

const redis = (() => {
	try {
		if (
			!process.env.UPSTASH_REDIS_REST_URL ||
			!process.env.UPSTASH_REDIS_REST_TOKEN
		) {
			console.warn(
				"[Middleware] Redis not configured - rate limiting disabled",
			);
			return null;
		}
		return Redis.fromEnv();
	} catch (error) {
		console.error("[Middleware] Failed to initialize Redis:", error);
		return null;
	}
})();

// Rate limiters configurés
const rateLimiters = {
	// Auth: Très strict (5 req / 15 min) - empêche brute force
	auth: redis
		? new Ratelimit({
				redis,
				limiter: Ratelimit.slidingWindow(5, "15 m"),
				analytics: true,
				prefix: "ratelimit:auth",
			})
		: null,

	// AI endpoints: Modéré (20 req / min) - protection coûts
	ai: redis
		? new Ratelimit({
				redis,
				limiter: Ratelimit.slidingWindow(20, "1 m"),
				analytics: true,
				prefix: "ratelimit:ai",
			})
		: null,

	// API générale: Permissif (100 req / min)
	general: redis
		? new Ratelimit({
				redis,
				limiter: Ratelimit.slidingWindow(100, "1 m"),
				analytics: true,
				prefix: "ratelimit:general",
			})
		: null,
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getClientIp(request: NextRequest): string {
	const forwardedFor = request.headers.get("x-forwarded-for");
	if (forwardedFor) {
		return forwardedFor.split(",")[0].trim();
	}
	const realIp = request.headers.get("x-real-ip");
	if (realIp) {
		return realIp;
	}
	return "unknown";
}

function getRateLimiter(
	pathname: string,
): { limiter: typeof rateLimiters.general; name: string } | null {
	if (pathname.startsWith("/api/auth/") || pathname.startsWith("/auth/")) {
		return { limiter: rateLimiters.auth, name: "auth" };
	}
	if (pathname.startsWith("/api/ai/")) {
		return { limiter: rateLimiters.ai, name: "ai" };
	}
	if (pathname.startsWith("/api/")) {
		return { limiter: rateLimiters.general, name: "general" };
	}
	return null;
}

function isProtectedRoute(pathname: string): boolean {
	return (
		pathname.startsWith("/dashboard") ||
		pathname.startsWith("/settings") ||
		pathname.startsWith("/profile") ||
		pathname.startsWith("/category") ||
		pathname.startsWith("/notes")
	);
}

function isAuthRoute(pathname: string): boolean {
	return (
		pathname.startsWith("/auth/login") || pathname.startsWith("/auth/signup")
	);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export async function proxy(request: NextRequest) {
	// Initialiser la réponse
	let response = NextResponse.next({ request });
	const { pathname } = request.nextUrl;

	// ═══════════════════════════════════════════════════════════════════════════
	// ÉTAPE 1: Rate Limiting (appliqué à tous, même non authentifiés)
	// ═══════════════════════════════════════════════════════════════════════════

	const rateLimitConfig = getRateLimiter(pathname);

	if (rateLimitConfig && rateLimitConfig.limiter) {
		const ip = getClientIp(request);
		const { limiter, name } = rateLimitConfig;

		try {
			const { success, limit, remaining, reset } = await limiter.limit(ip);

			// Log pour monitoring (rate limit proche ou dépassé)
			if (remaining <= 5 || !success) {
				console.log(
					`[RateLimit] ${name} - IP: ${ip}, Remaining: ${remaining}/${limit}, Success: ${success}`,
				);
			}

			// Construire la réponse de rate limit
			if (!success) {
				const rateLimitResponse = NextResponse.json(
					{
						error: "Too many requests. Please slow down.",
						code: "RATE_LIMIT_EXCEEDED",
						retry_after: Math.ceil((reset - Date.now()) / 1000),
					},
					{ status: 429 },
				);

				// Copier les headers de rate limiting
				rateLimitResponse.headers.set("X-RateLimit-Limit", String(limit));
				rateLimitResponse.headers.set("X-RateLimit-Remaining", "0");
				rateLimitResponse.headers.set("X-RateLimit-Reset", String(reset));
				rateLimitResponse.headers.set("X-RateLimit-Policy", name);

				return rateLimitResponse;
			}

			// Ajouter les headers à la réponse principale
			response.headers.set("X-RateLimit-Limit", String(limit));
			response.headers.set("X-RateLimit-Remaining", String(remaining));
			response.headers.set("X-RateLimit-Reset", String(reset));
			response.headers.set("X-RateLimit-Policy", name);
		} catch (error) {
			// En cas d'erreur Redis, loguer mais continuer (fail open)
			console.error(`[Middleware] Redis error for ${pathname}:`, error);
		}
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// ÉTAPE 2: Authentification Supabase
	// ═══════════════════════════════════════════════════════════════════════════

	// Créer le client Supabase avec gestion des cookies
	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
		{
			cookies: {
				getAll() {
					return request.cookies.getAll();
				},
				setAll(cookiesToSet: { name: any; value: any; options: any }[]) {
					// Recréer la réponse pour capturer les cookies
					response = NextResponse.next({ request });

					// Copier les headers de rate limiting si présents
					const rateLimitHeaders = [
						"X-RateLimit-Limit",
						"X-RateLimit-Remaining",
						"X-RateLimit-Reset",
						"X-RateLimit-Policy",
					];
					rateLimitHeaders.forEach((header) => {
						const value = request.headers.get(header);
						if (value) response.headers.set(header, value);
					});

					// Définir les cookies Supabase
					cookiesToSet.forEach(({ name, value, options }) => {
						response.cookies.set(name, value, options);
					});
				},
			},
		},
	);

	// Rafraîchir la session si expirée
	const {
		data: { user },
	} = await supabase.auth.getUser();

	// ═══════════════════════════════════════════════════════════════════════════
	// ÉTAPE 3: Protection des routes
	// ═══════════════════════════════════════════════════════════════════════════

	// Rediriger vers login si route protégée et pas authentifié
	if (!user && isProtectedRoute(pathname)) {
		const url = request.nextUrl.clone();
		url.pathname = "/auth/login";
		url.searchParams.set("redirectTo", pathname);

		// Copier les headers de rate limiting dans la redirection
		const redirectResponse = NextResponse.redirect(url);
		[
			"X-RateLimit-Limit",
			"X-RateLimit-Remaining",
			"X-RateLimit-Reset",
			"X-RateLimit-Policy",
		].forEach((header) => {
			const value = response.headers.get(header);
			if (value) redirectResponse.headers.set(header, value);
		});

		return redirectResponse;
	}

	// Rediriger vers dashboard si déjà authentifié sur page d'auth
	if (user && isAuthRoute(pathname)) {
		const url = request.nextUrl.clone();
		url.pathname = "/dashboard";

		const redirectResponse = NextResponse.redirect(url);
		[
			"X-RateLimit-Limit",
			"X-RateLimit-Remaining",
			"X-RateLimit-Reset",
			"X-RateLimit-Policy",
		].forEach((header) => {
			const value = response.headers.get(header);
			if (value) redirectResponse.headers.set(header, value);
		});

		return redirectResponse;
	}

	return response;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION MATCHER
// ═══════════════════════════════════════════════════════════════════════════════

export const config = {
	matcher: [
		/*
		 * Match all request paths except:
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 * - public files (public folder)
		 */
		{
			source:
				"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
			missing: [
				{ type: "header", key: "next-router-prefetch" },
				{ type: "header", key: "purpose", value: "prefetch" },
			],
		},
	],
};
