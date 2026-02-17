import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
	decryptOpenRouterKey,
	encryptOpenRouterKey,
	getKeyLast4,
} from "@/lib/security/byok-crypto";
import { auditLogServer, AuditAction } from "@/lib/security/audit";
import { createClient } from "@/lib/supabase/server";

const saveSchema = z.object({
	apiKey: z
		.string()
		.min(10, "API key is too short")
		.max(300, "API key is too long"),
});

const testSchema = z
	.object({
		apiKey: z.string().min(10).max(300).optional(),
	})
	.optional();

type UserAiKeyRow = {
	encrypted_key: string;
	key_last4: string;
	updated_at: string | null;
};

async function getAuthenticatedUser(request: NextRequest) {
	const supabase = await createClient(request);
	const {
		data: { user },
		error,
	} = await supabase.auth.getUser();

	if (error || !user) {
		return { supabase, user: null };
	}

	return { supabase, user };
}

export async function GET(request: NextRequest) {
	const { supabase, user } = await getAuthenticatedUser(request);
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { data, error } = await supabase
		.from("user_ai_keys")
		.select("encrypted_key, key_last4, updated_at")
		.eq("user_id", user.id)
		.maybeSingle<UserAiKeyRow>();

	if (error) {
		console.error("Failed to read user AI key:", error);
		return NextResponse.json(
			{ error: "Failed to read OpenRouter key settings" },
			{ status: 500 },
		);
	}

	if (!data) {
		return NextResponse.json({ hasKey: false }, { status: 200 });
	}

	return NextResponse.json(
		{
			hasKey: true,
			keyLast4: data.key_last4,
			updatedAt: data.updated_at,
		},
		{ status: 200 },
	);
}

export async function PUT(request: NextRequest) {
	const { supabase, user } = await getAuthenticatedUser(request);
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	const parsed = saveSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid input", details: parsed.error.issues },
			{ status: 400 },
		);
	}

	const apiKey = parsed.data.apiKey.trim();
	let encryptedKey = "";
	try {
		encryptedKey = encryptOpenRouterKey(apiKey);
	} catch (error) {
		console.error("BYOK encryption failed:", error);
		return NextResponse.json(
			{ error: "Server encryption is not configured for BYOK keys." },
			{ status: 500 },
		);
	}
	const keyLast4 = getKeyLast4(apiKey);

	// Vérifier si c'est une création ou une mise à jour
	const { data: existingKey } = await supabase
		.from("user_ai_keys")
		.select("user_id")
		.eq("user_id", user.id)
		.maybeSingle();

	const isUpdate = !!existingKey;

	const { data, error } = await supabase
		.from("user_ai_keys")
		.upsert(
			{
				user_id: user.id,
				encrypted_key: encryptedKey,
				key_last4: keyLast4,
			},
			{ onConflict: "user_id" },
		)
		.select("key_last4, updated_at")
		.single<{ key_last4: string; updated_at: string | null }>();

	if (error) {
		console.error("Failed to save user AI key:", error);
		return NextResponse.json(
			{ error: "Failed to save OpenRouter key" },
			{ status: 500 },
		);
	}

	// AUDIT LOG: Création ou mise à jour de clé BYOK
	await auditLogServer({
		action: isUpdate ? AuditAction.BYOK_KEY_UPDATED : AuditAction.BYOK_KEY_CREATED,
		resourceType: 'AI_KEY',
		request,
		metadata: {
			key_last4: keyLast4,
			method: isUpdate ? 'update' : 'create',
			status: 'success',
		},
	});

	return NextResponse.json(
		{
			hasKey: true,
			keyLast4: data.key_last4,
			updatedAt: data.updated_at,
		},
		{ status: 200 },
	);
}

export async function DELETE(request: NextRequest) {
	const { supabase, user } = await getAuthenticatedUser(request);
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	// Récupérer les infos avant suppression pour l'audit
	const { data: existingKey } = await supabase
		.from("user_ai_keys")
		.select("key_last4")
		.eq("user_id", user.id)
		.maybeSingle();

	const { error } = await supabase
		.from("user_ai_keys")
		.delete()
		.eq("user_id", user.id);

	if (error) {
		console.error("Failed to delete user AI key:", error);
		return NextResponse.json(
			{ error: "Failed to delete OpenRouter key" },
			{ status: 500 },
		);
	}

	// AUDIT LOG: Suppression de clé BYOK
	await auditLogServer({
		action: AuditAction.BYOK_KEY_DELETED,
		resourceType: 'AI_KEY',
		request,
		metadata: {
			key_last4: existingKey?.key_last4 || 'unknown',
			status: 'success',
		},
	});

	return NextResponse.json({ hasKey: false }, { status: 200 });
}

export async function POST(request: NextRequest) {
	const { supabase, user } = await getAuthenticatedUser(request);
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	let body: unknown = undefined;
	try {
		const rawText = await request.text();
		if (rawText.trim()) {
			body = JSON.parse(rawText) as unknown;
		}
	} catch {
		return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	const parsed = testSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid input", details: parsed.error.issues },
			{ status: 400 },
		);
	}

	let apiKeyToTest = parsed.data?.apiKey?.trim() || "";

	if (!apiKeyToTest) {
		const { data, error } = await supabase
			.from("user_ai_keys")
			.select("encrypted_key")
			.eq("user_id", user.id)
			.maybeSingle<{ encrypted_key: string }>();

		if (error) {
			console.error("Failed to load stored key for test:", error);
			return NextResponse.json(
				{ error: "Unable to access stored key" },
				{ status: 500 },
			);
		}

		if (!data?.encrypted_key) {
			return NextResponse.json(
				{ error: "No API key configured to test" },
				{ status: 400 },
			);
		}

		try {
			apiKeyToTest = decryptOpenRouterKey(data.encrypted_key);
		} catch {
			return NextResponse.json(
				{ error: "Stored API key is corrupted. Please save a new key." },
				{ status: 400 },
			);
		}
	}

	try {
		const response = await fetch("https://openrouter.ai/api/v1/models", {
			method: "GET",
			headers: {
				Authorization: `Bearer ${apiKeyToTest}`,
			},
		});

		if (!response.ok) {
			const errorPayload = await response.json().catch(() => null);
			const message =
				(errorPayload as { error?: { message?: string } } | null)?.error
					?.message || "Key test failed against OpenRouter.";
			
			// AUDIT LOG: Test de clé échoué
			await auditLogServer({
				action: AuditAction.BYOK_KEY_TESTED,
				resourceType: 'AI_KEY',
				request,
				metadata: {
					status: 'failure',
					openrouter_status: response.status,
					error_message: message,
				},
			});
			
			return NextResponse.json(
				{ valid: false, error: message },
				{ status: response.status },
			);
		}

		// AUDIT LOG: Test de clé réussi
		await auditLogServer({
			action: AuditAction.BYOK_KEY_TESTED,
			resourceType: 'AI_KEY',
			request,
			metadata: {
				status: 'success',
				openrouter_status: response.status,
			},
		});

		return NextResponse.json({ valid: true }, { status: 200 });
	} catch (error) {
		console.error("OpenRouter key test failed:", error);
		
		// AUDIT LOG: Test de clé échoué (erreur réseau)
		await auditLogServer({
			action: AuditAction.BYOK_KEY_TESTED,
			resourceType: 'AI_KEY',
			request,
			metadata: {
				status: 'failure',
				error_type: 'network_error',
				error_message: error instanceof Error ? error.message : 'Unknown error',
			},
		});
		
		return NextResponse.json(
			{
				valid: false,
				error: "Failed to reach OpenRouter during key test.",
			},
			{ status: 503 },
		);
	}
}
