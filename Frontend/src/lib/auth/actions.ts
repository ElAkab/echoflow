"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers"; // To get request headers

export async function signInWithGoogle() {
	const supabase = await createClient();
	const origin = (await headers()).get("origin");

	const { data, error } = await supabase.auth.signInWithOAuth({
		provider: "google",
		options: {
			redirectTo: `${origin}/auth/callback`,
		},
	});

	if (error) {
		console.error("Google OAuth error:", error);
		return { error: error.message };
	}

	if (data.url) {
		redirect(data.url);
	}
}

// Sign in using email magic link
export async function signInWithEmail(formData: FormData) {
	const supabase = await createClient(); // Create a Supabase client instance
	const email = formData.get("email") as string; // Get email from form data
	const origin = (await headers()).get("origin"); // Get the origin for redirect URL

	if (!email) {
		return { error: "Email is required" };
	}

	const { error } = await supabase.auth.signInWithOtp({
		email,
		options: {
			emailRedirectTo: `${origin}/auth/callback`,
		},
	});

	if (error) {
		console.error("Magic Link error:", error);
		return { error: error.message };
	}

	return { success: true, message: "Check your email for the login link!" };
}

export async function signOut() {
	const supabase = await createClient();
	const { error } = await supabase.auth.signOut();
	if (error) {
		console.error("Sign out error:", error);
		return { error: error.message };
	}
	redirect("/auth/login");
}

export async function getUser() {
	const supabase = await createClient();
	const {
		data: { user },
		error,
	} = await supabase.auth.getUser();
	if (error) {
		console.error("Get user error:", error);
		return null;
	}
	return user;
}

export async function getUserProfile() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return null;
	const { data: profile } = await supabase
		.from("profiles")
		.select("*")
		.eq("id", user.id)
		.single();
	return profile;
}

// Sign in with demo account
export async function signInWithDemo(providedPassword: string) {
	const supabase = await createClient();

	// Verify the provided password matches the demo password
	if (providedPassword !== process.env.DEMO_ACCOUNT_PASSWORD) {
		return { error: "Invalid demo password" };
	}

	const { data, error } = await supabase.auth.signInWithPassword({
		email: "demo@brainloop.app",
		password: process.env.DEMO_ACCOUNT_PASSWORD || "",
	});

	if (error) {
		console.error("Demo sign in error:", error);
		return { error: error.message };
	}

	redirect("/dashboard");
}
