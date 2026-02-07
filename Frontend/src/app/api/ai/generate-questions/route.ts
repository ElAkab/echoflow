import {
	streamOpenRouterResponse,
	METADATA_DELIMITER,
} from "@/app/api/ai/_utils/openrouter-stream";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const OPENROUTER_DEV_API_KEY = process.env.OPENROUTER_DEV_API_KEY;
const OPENROUTER_PROD_API_KEY = process.env.OPENROUTER_PROD_API_KEY;
const NODE_ENV = process.env.NODE_ENV || "development";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

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

	// OpenRouter error shapes vary; try to detect common cases
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

	// fallback: check numeric codes
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

		const { noteId, messages } = await request.json();

		if (!noteId) {
			return NextResponse.json(
				{ error: "Note ID is required" },
				{ status: 400 },
			);
		}

		// Fetch note with category
		const { data: note, error: noteError } = await supabase
			.from("notes")
			.select("*, categories(name)")
			.eq("id", noteId)
			.eq("user_id", user.id)
			.single();

		if (noteError || !note) {
			return NextResponse.json({ error: "Note not found" }, { status: 404 });
		}

		// Fetch last study session for this note to get previous AI feedback
		// ONLY if we want to build upon previous sessions
		const { data: lastSession } = await supabase
			.from("study_sessions")
			.select("ai_feedback")
			.contains("note_ids", [noteId])
			.eq("user_id", user.id)
			.order("created_at", { ascending: false })
			.limit(1)
			.single();

		let previousConclusion = "";
		if (lastSession?.ai_feedback) {
			try {
				const feedback = JSON.parse(lastSession.ai_feedback);
				previousConclusion = feedback.conclusion || "";
				console.log("Using previous session conclusion:", previousConclusion);
			} catch (e) {
				console.warn("Failed to parse previous ai_feedback:", e);
			}
		} else {
			console.log("No previous session found for this note");
		}

		// Build conversation messages
		const categoryName = note.categories?.name || "General";
		const systemPrompt = `You are a helpful AI tutor helping students review their study notes through interactive conversation.

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
- Do NOT expose your reasoning process

**Context for THIS session:**
Category: ${categoryName}
Note Content:
${note.content}
${previousConclusion ? `\n\nPrevious Session Insight (use ONLY as context, do NOT assume current knowledge):\n${previousConclusion}` : ""}

**Guidelines for the chat response:**
- If this is the first message: ask ONE relevant, open-ended question about the note content
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

		const conversationMessages = [
			{ role: "system", content: systemPrompt },
			...(messages || []),
		];

		// Call OpenRouter API with model rotation
		// Decide which OpenRouter key to use. In production we require the PROD key.
		const OPENROUTER_API_KEY =
			NODE_ENV === "production"
				? OPENROUTER_PROD_API_KEY
				: OPENROUTER_DEV_API_KEY || OPENROUTER_PROD_API_KEY;

		if (!OPENROUTER_API_KEY) {
			return NextResponse.json(
				{ error: "OpenRouter API key not configured" },
				{ status: 500 },
			);
		}

		if (
			NODE_ENV === "production" &&
			OPENROUTER_API_KEY === OPENROUTER_DEV_API_KEY
		) {
			console.error(
				"OpenRouter: refusing to use development API key in production",
			);
			return NextResponse.json(
				{
					error:
						"OpenRouter API key misconfigured for production. Set OPENROUTER_PROD_API_KEY.",
					code: "invalid_api_key",
				},
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
		const modelsToTry = isPremium ? PREMIUM_MODELS : FREE_MODELS; // temporaire : essayer les modèles gratuits même pour les PRO pendant le développement

		// Try each model in sequence until one succeeds
		let lastError = null;
		for (const model of modelsToTry) {
			try {
				const response = await fetch(
					`${OPENROUTER_BASE_URL}/chat/completions`,
					{
						method: "POST",
						headers: {
							Authorization: `Bearer ${OPENROUTER_API_KEY}`,
							"Content-Type": "application/json",
							"HTTP-Referer":
								process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
							"X-Title": "Echoflow",
						},
						body: JSON.stringify({
							model,
							messages: conversationMessages,
							temperature: 0.7,
							max_tokens: 500,
							stream: true,
						}),
					},
				);

				if (!response.ok) {
					const errorData = await response.json().catch(() => null);
					const classified = classifyOpenRouterError(errorData);
					console.warn(
						`Model ${model} failed (${classified || "unknown"}):`,
						errorData,
					);
					lastError = errorData;

					// Rotation rules
					if (classified === "invalid_model") {
						// Ignore and continue to next model
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

					// Unknown error: do not keep trying infinitely — continue to next model but track lastError
					continue;
				}

				return streamOpenRouterResponse(response, model);
			} catch (error) {
				console.warn(`Model ${model} threw error:`, error);
				lastError = error;
				continue; // Try next model
			}
		}

		// All models failed
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
	} catch (error) {
		console.error("AI conversation error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
