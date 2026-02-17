import {
	streamOpenRouterResponse,
	METADATA_DELIMITER,
} from "@/app/api/ai/_utils/openrouter-stream";
import {
	routeOpenRouterRequest,
	type OpenRouterMessage,
} from "@/app/api/ai/_utils/openrouter-routing";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { hasCredits, consumeCredit, getDailyUsage } from "@/lib/credits";

type IncomingChatMessage = {
	role: "user" | "assistant";
	content: string;
};

function normalizeIncomingMessages(payload: unknown): OpenRouterMessage[] {
	if (!Array.isArray(payload)) return [];

	return payload.flatMap((entry) => {
		if (!entry || typeof entry !== "object") return [];
		const maybeRole = (entry as Record<string, unknown>).role;
		const maybeContent = (entry as Record<string, unknown>).content;

		if (
			(maybeRole === "user" || maybeRole === "assistant") &&
			typeof maybeContent === "string" &&
			maybeContent.trim().length > 0
		) {
			const message: IncomingChatMessage = {
				role: maybeRole,
				content: maybeContent,
			};
			return [message];
		}

		return [];
	});
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

		// Vérifier les crédits (BYOK = gratuit, crédits achetés, ou quota gratuit)
		const hasAvailableCredits = await hasCredits(user.id);
		if (!hasAvailableCredits) {
			return NextResponse.json(
				{
					error: "Crédits insuffisants",
					code: "credits_exhausted",
					message: "Vous n'avez plus de crédits. Achetez des Study Questions ou utilisez votre propre clé OpenRouter.",
				},
				{ status: 403 },
			);
		}

		// Consommer un crédit (si pas BYOK)
		const consumptionResult = await consumeCredit(user.id);
		if (!consumptionResult.success && consumptionResult.balance !== -1) {
			// -1 = BYOK (pas de consommation)
			return NextResponse.json(
				{
					error: "Échec de la consommation de crédits",
					code: "consumption_failed",
					message: consumptionResult.message,
				},
				{ status: 500 },
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
- Respond in the language of the note content (detect it). If the note is in French, respond in French. If in English, respond in English. Only switch if the student explicitly uses a different language.
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

		const conversationMessages: OpenRouterMessage[] = [
			{ role: "system", content: systemPrompt },
			...normalizeIncomingMessages(messages),
		];

		const aiResult = await routeOpenRouterRequest({
			supabase,
			userId: user.id,
			messages: conversationMessages,
			temperature: 0.7,
			stream: true,
			actionType: "QUIZ",
		});

		if (!aiResult.ok) {
			return NextResponse.json(
				{
					error: aiResult.error,
					code: aiResult.code,
					details: aiResult.details,
				},
				{ status: aiResult.status },
			);
		}

		return streamOpenRouterResponse(
			aiResult.response,
			aiResult.model,
			aiResult.keySource,
		);
	} catch (error) {
		console.error("AI conversation error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
