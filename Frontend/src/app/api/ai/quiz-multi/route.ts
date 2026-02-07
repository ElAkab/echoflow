import {
	streamOpenRouterResponse,
	METADATA_DELIMITER,
} from "@/app/api/ai/_utils/openrouter-stream";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// List of free models to rotate through
// List of free models to rotate through
const FREE_MODELS = [
	// "google/gemini-2.0-flash-exp:free", // indisponible (404)
	"meta-llama/llama-3.2-3b-instruct:free", // temporairement rate-limited (429), peut retenter
	"z-ai/glm-4.5-air:free", // payload incompatible (400), nécessite ajustement du prompt
	// "openai/gpt-oss-120b:free", // bloqué par politique free (404)
	"stepfun/step-3.5-flash:free", // OK

	"meta-llama/llama-3.3-70b-instruct:free", // OK
	"qwen/qwen-3-235b-a22b:free", // OK
	"mistralai/mistral-small-3.1-24b:free", // OK
	"google/gemma-3-4b-instruct:free", // OK
];

// Potential premium / higher-capacity models to try during development (explicit list)
// These are placeholders — pick appropriate paid models when available.
const PREMIUM_MODELS = [
	"openai/gpt-4o-mini:paid", // économique et polyvalent
	"mistralai/mistral-7b-instruct:paid", // milieu de gamme raisonnable
	// "google/gemini-1-pro:paid",      // 💰 à surveiller / tester en dernier
	// "anthropic/claude-3-opus:paid",  // 💸 trop coûteux pour tests
	// ...FREE_MODELS,
];

function classifyOpenRouterError(errorData: any) {
	if (!errorData) return null;
	const err = errorData.error || errorData;
	const message = (err?.message || err?.code || "").toString().toLowerCase();

	if (message.includes("context") && message.includes("length"))
		return "context_length_exceeded";
	if (message.includes("quota") || message.includes("insufficient"))
		return "insufficient_quota";
	if (
		message.includes("rate") ||
		message.includes("limit") ||
		message.includes("429")
	)
		return "rate_limit_exceeded";
	if (message.includes("model") && message.includes("invalid"))
		return "invalid_model";

	if (
		err?.code === "CONTEXT_LENGTH_EXCEEDED" ||
		err?.type === "context_length_exceeded"
	)
		return "context_length_exceeded";
	if (err?.code === "INSUFFICIENT_QUOTA" || err?.type === "insufficient_quota")
		return "insufficient_quota";
	if (err?.code === 429 || err?.status === 429) return "rate_limit_exceeded";

	return null;
}

let currentModelIndex = 0;

const OPENROUTER_KEY =
	process.env.OPENROUTER_API_KEY ||
	process.env.OPENROUTER_DEV_API_KEY ||
	process.env.OPENROUTER_PROD_API_KEY;
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

async function callOpenRouter(
	messages: any[],
	retryCount = 0,
): Promise<string> {
	if (retryCount >= FREE_MODELS.length) {
		throw new Error(
			"All free models are currently unavailable. Please try again later.",
		);
	}

	const model = FREE_MODELS[currentModelIndex];

	try {
		if (!OPENROUTER_KEY) {
			throw new Error(
				JSON.stringify({
					error:
						"OpenRouter API key not configured (OPENROUTER_API_KEY|OPENROUTER_DEV_API_KEY|OPENROUTER_PROD_API_KEY)",
				}),
			);
		}

		const response = await fetch(
			"https://openrouter.ai/api/v1/chat/completions",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${OPENROUTER_KEY}`,
					"Content-Type": "application/json",
					"HTTP-Referer":
						process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
					"X-Title": "Echoflow",
				},
				body: JSON.stringify({
					model,
					messages,
				}),
			},
		);

		if (!response.ok) {
			const error = await response.json();

			// Si erreur 429 (rate limit), essayer le modèle suivant
			if (response.status === 429 || error.error?.code === 429) {
				console.log(`Model ${model} rate limited, switching to next model...`);
				currentModelIndex = (currentModelIndex + 1) % FREE_MODELS.length;
				return callOpenRouter(messages, retryCount + 1);
			}

			throw new Error(JSON.stringify(error));
		}

		const data = await response.json();

		// Rotation automatique après chaque succès
		currentModelIndex = (currentModelIndex + 1) % FREE_MODELS.length;

		return data.choices[0].message.content;
	} catch (error: any) {
		if (retryCount < FREE_MODELS.length - 1) {
			currentModelIndex = (currentModelIndex + 1) % FREE_MODELS.length;
			return callOpenRouter(messages, retryCount + 1);
		}
		throw error;
	}
}

export async function POST(request: NextRequest) {
	try {
		const supabase = await createClient(request);
		const {
			data: { user },
			error: authError,
		} = await supabase.auth.getUser();

		if (authError || !user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { noteIds, messages } = await request.json();

		if (!noteIds || !Array.isArray(noteIds) || noteIds.length === 0) {
			return NextResponse.json(
				{ error: "noteIds array is required" },
				{ status: 400 },
			);
		}

		// Fetch all selected notes
		const { data: notes, error: notesError } = await supabase
			.from("notes")
			.select("id, title, content, category_id")
			.in("id", noteIds)
			.eq("user_id", user.id);

		if (notesError || !notes || notes.length === 0) {
			return NextResponse.json({ error: "Notes not found" }, { status: 404 });
		}

		// Get category_id (use first note's category, or null if mixed)
		const categoryIds = [
			...new Set(notes.map((n) => n.category_id).filter(Boolean)),
		];
		const categoryId = categoryIds.length === 1 ? categoryIds[0] : null;

		const selectedNoteIds = new Set(noteIds);
		const feedbackLimit = Math.min(50, Math.max(noteIds.length * 5, 10));
		const { data: recentSessions, error: recentSessionsError } = await supabase
			.from("study_sessions")
			.select("note_ids, ai_feedback, created_at")
			.overlaps("note_ids", noteIds)
			.eq("user_id", user.id)
			.order("created_at", { ascending: false })
			.limit(feedbackLimit);

		if (recentSessionsError) {
			console.warn(
				"Failed to fetch recent study sessions:",
				recentSessionsError,
			);
		}

		const conclusionByNote = new Map<string, string>();
		for (const session of recentSessions || []) {
			if (!session?.ai_feedback) continue;

			let feedback: any = session.ai_feedback;
			if (typeof feedback === "string") {
				try {
					feedback = JSON.parse(feedback);
				} catch {
					continue;
				}
			}

			if (!feedback || typeof feedback !== "object") continue;
			const conclusion =
				typeof feedback.conclusion === "string" ? feedback.conclusion : "";
			if (!conclusion) continue;

			const sessionNoteIds = Array.isArray(session.note_ids)
				? session.note_ids
				: [];

			for (const noteId of sessionNoteIds) {
				if (!selectedNoteIds.has(noteId)) continue;
				if (!conclusionByNote.has(noteId)) {
					conclusionByNote.set(noteId, conclusion);
				}
			}

			if (conclusionByNote.size >= selectedNoteIds.size) break;
		}

		const noteTitleMap = new Map(
			notes.map((note) => [note.id, note.title || "Untitled note"]),
		);
		const insightLines = noteIds
			.map((noteId) => {
				const conclusion = conclusionByNote.get(noteId);
				if (!conclusion) return null;
				const title = noteTitleMap.get(noteId) || "Untitled note";
				return `- ${title}: ${conclusion}`;
			})
			.filter(Boolean);
		const previousInsightsBlock =
			insightLines.length > 0
				? `\n\nPrevious Session Insights (per note, use ONLY as context, do NOT assume current knowledge):\n${insightLines.join("\n")}`
				: "";

		// Combine all notes content
		const combinedContent = notes
			.map((note) => `**${note.title}**\n${note.content}`)
			.join("\n\n---\n\n");

		// Prepare system prompt with JSON response format
		const systemPrompt = `You are a helpful AI tutor helping students review and connect multiple study notes through interactive conversation.

**CRITICAL INSTRUCTIONS:**
1. DO NOT include your internal reasoning, thinking process, or chain-of-thought
2. DO NOT make assumptions about the student's knowledge unless they explicitly demonstrate it in their answers
3. ONLY base your assessment on: the provided note content + the student's actual responses in THIS session

**OUTPUT FORMAT (STRICT):**
Return two parts in this exact order:
1) Your chat response in Markdown (no JSON, no code fences)
2) The delimiter line: <<METADATA_JSON>> (must be preceded by two newlines and followed by a newline)
3) A single valid JSON object with keys "analysis", "weaknesses", "conclusion"

**Example:**
Correct ✅ Here is a short explanation...${METADATA_DELIMITER}{"analysis":"...","weaknesses":"...","conclusion":"..."}

**Rules:**
- Do NOT include the delimiter anywhere else
- The JSON must be valid and use double quotes
- Keep the chat response under 100 words
- DO NOT expose your reasoning process

**Context for THIS session:**
The student has selected ${notes.length} note${notes.length > 1 ? "s" : ""} from category_id: ${categoryId || "mixed categories"}.

Combined Note Content:
${combinedContent}
${previousInsightsBlock}

**Guidelines for the chat response:**
- If this is the first message: ask ONE relevant, open-ended question that tests understanding across the selected notes
- Help the student connect ideas between notes (concepts, themes, contrasts)
- Respond in the same language as the student's last message
- Use Markdown: **bold**, bullets where helpful
- If the student answered, follow this structure:
  1. Start with: "Correct ✅" / "Almost 🤏" / "Incorrect ❌"
  2. Brief explanation (under 60 words, use Markdown)
  3. Ask ONE thoughtful follow-up question
- Be conversational, encouraging, focused
- Keep the chat response under 100 words

**Guidelines for metadata fields:**
- "analysis": ONLY concepts the student has explicitly demonstrated in their answers
- "weaknesses": ONLY based on incorrect/incomplete answers in THIS session
- "conclusion": Actionable insight based on THIS session's performance only (e.g., "Student demonstrated X", "Needs practice on Y based on answer Z")
`;

		// Build conversation history
		const aiMessages = [{ role: "system", content: systemPrompt }, ...messages];

		// Call OpenRouter with retry logic and return a streaming response (SSE)
		if (!OPENROUTER_KEY) {
			return NextResponse.json(
				{ error: "OpenRouter API key not configured" },
				{ status: 500 },
			);
		}

		// Determine subscription tier from `profiles` table (preferred) or fallback to user metadata
		let subscriptionTier = "FREE";
		try {
			const { data: profile } = await supabase
				.from("profiles")
				.select("subscription_tier")
				.eq("id", user.id)
				.maybeSingle();
			if (profile?.subscription_tier)
				subscriptionTier = profile.subscription_tier;
		} catch (e) {
			console.warn(
				"Failed to read profile subscription_tier, falling back to user metadata",
				e,
			);
			if (
				user?.user_metadata?.is_premium ||
				user?.app_metadata?.plan === "premium"
			) {
				subscriptionTier = "PRO";
			}
		}

		const isPremium = subscriptionTier === "PRO";
		const modelsToTry = isPremium ? PREMIUM_MODELS : FREE_MODELS; // Temporaire

		let lastError: any = null;
		for (const model of modelsToTry) {
			try {
				const response = await fetch(
					`${OPENROUTER_BASE_URL}/chat/completions`,
					{
						method: "POST",
						headers: {
							Authorization: `Bearer ${OPENROUTER_KEY}`,
							"Content-Type": "application/json",
							"HTTP-Referer":
								process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
							"X-Title": "Echoflow",
						},
						body: JSON.stringify({
							model,
							messages: aiMessages,
							temperature: 0.7,
							max_tokens: 500,
							stream: true,
						}),
					},
				);

				if (!response.ok) {
					const errData = await response.json().catch(() => null);
					const classified = classifyOpenRouterError(errData);
					console.warn(
						`Model ${model} failed (${classified || "unknown"}):`,
						errData,
					);
					lastError = errData || { status: response.status };

					if (classified === "invalid_model") {
						// try next model
						continue;
					}

					if (classified === "context_length_exceeded") {
						console.error("Context length exceeded for model:", model);
						return NextResponse.json(
							{
								error: "Context length exceeded for this model",
								code: "context_length_exceeded",
								recommendedAction: "reduce_prompt_or_upgrade",
							},
							{ status: 400 },
						);
					}

					if (classified === "insufficient_quota") {
						console.error("Insufficient quota (OpenRouter) for model:", model);
						return NextResponse.json(
							{
								error: "Insufficient quota on OpenRouter",
								code: "insufficient_quota",
							},
							{ status: 503 },
						);
					}

					if (classified === "rate_limit_exceeded") {
						console.warn("Rate limit reached for model:", model);
						return NextResponse.json(
							{ error: "Rate limit reached", code: "rate_limit_exceeded" },
							{ status: 429 },
						);
					}

					// Unknown error: continue to next model
					continue;
				}

				return streamOpenRouterResponse(response, model);
			} catch (err) {
				console.warn(`Model ${model} threw error:`, err);
				lastError = err;
				continue;
			}
		}

		console.error("All models failed. Last error:", lastError);

		// Determine appropriate error code based on last error
		const errorCode =
			lastError?.error?.code === 429 ||
			(typeof lastError === "object" && lastError?.message?.includes("rate"))
				? "RATE_LIMIT_EXCEEDED"
				: "ALL_MODELS_FAILED";

		return NextResponse.json(
			{
				error:
					"All AI models are currently unavailable. Please try again later.",
				code: errorCode,
				details: lastError,
			},
			{ status: 503 },
		);
	} catch (error: any) {
		console.error("Error in quiz-multi:", error);
		return NextResponse.json(
			{ error: error.message || "Failed to generate response" },
			{ status: 500 },
		);
	}
}
