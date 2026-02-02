/**
 * MIDDLEWARE - Route Protection
 *
 * Ce middleware s'exécute sur toutes les requêtes
 * Il redirige les utilisateurs non-authentifiés vers /auth/login
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
	let supabaseResponse = NextResponse.next({
		request,
	});

	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
		{
			cookies: {
				getAll() {
					return request.cookies.getAll();
				},
				setAll(cookiesToSet: Array<{
          name: string;
          value: string;
          options?: any;
        }>) {
					supabaseResponse = NextResponse.next({
						request,
					});
					cookiesToSet.forEach(({ name, value, options }) =>
						supabaseResponse.cookies.set(name, value, options),
					);
				},
			},
		},
	);

	// Refresh session if expired
	const {
		data: { user },
	} = await supabase.auth.getUser();

	// Protected routes
	if (
		!user &&
		(request.nextUrl.pathname.startsWith("/dashboard") ||
			request.nextUrl.pathname.startsWith("/settings") ||
			request.nextUrl.pathname.startsWith("/profile") ||
			request.nextUrl.pathname.startsWith("/category"))
	) {
		// Redirect to login
		const url = request.nextUrl.clone();
		url.pathname = "/auth/login";
		url.searchParams.set("redirectTo", request.nextUrl.pathname);
		return NextResponse.redirect(url);
	}

	// Redirect authenticated users away from auth pages
	if (user && request.nextUrl.pathname.startsWith("/auth/login")) {
		const url = request.nextUrl.clone();
		url.pathname = "/dashboard";
		return NextResponse.redirect(url);
	}

	return supabaseResponse;
}

export const config = {
	matcher: [
		/*
		 * Match all request paths except:
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 * - public files (public folder)
		 */
		"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
	],
};
