import { streamOpenRouterResponse } from "@/app/api/ai/_utils/openrouter-stream";
import {
	routeOpenRouterRequest,
	type OpenRouterMessage,
} from "@/app/api/ai/_utils/openrouter-routing";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { checkCredits, consumeCredit } from "@/lib/credits";

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

		// Check if this is the first message of a session
		const isFirstMessage = !messages || messages.length === 0;

		// Only consume credits on first message of session
		if (!isFirstMessage) {
			// Subsequent messages in same session don't consume credits
			console.log("[Session] Subsequent message, skipping credit consumption");
		}

		if (!noteId) {
			return NextResponse.json(
				{ error: "Note ID is required" },
				{ status: 400 },
			);
		}

		// Step 1: Check credits availability (without consuming yet)
		const creditCheck = await checkCredits(user.id);
		if (!creditCheck.hasCredits) {
			return NextResponse.json(
				{
					error: "Insufficient credits",
					code: "credits_exhausted",
					message:
						"You don't have enough credits. Buy more Study Questions or use your own OpenRouter key.",
				},
				{ status: 403 },
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
		const { data: lastSession } = await supabase
			.from("study_sessions")
			.select("ai_feedback")
			.contains("note_ids", [noteId])
			.eq("user_id", user.id)
			.order("created_at", { ascending: false })
			.limit(1)
			.maybeSingle();

		// Only fetch previous conclusion if this is NOT the first message
		// For first messages, we want a clean start without previous context pollution
		let previousConclusion = "";
		if (!isFirstMessage && lastSession?.ai_feedback) {
			try {
				const feedback = JSON.parse(lastSession.ai_feedback);
				previousConclusion = feedback.conclusion || "";
				console.log("Using previous session conclusion:", previousConclusion);
			} catch (e) {
				console.warn("Failed to parse previous ai_feedback:", e);
			}
		}

		// Build conversation messages
		const categoryName = note.categories?.name || "General";
		const systemPrompt = `You are a helpful AI tutor helping students review their study notes through interactive conversation.

**CRITICAL CONTEXT:**
isFirstMessage: ${isFirstMessage ? "TRUE" : "FALSE"}
${isFirstMessage ? "→ This is the START of a new quiz session. You MUST ask a question first." : "→ This is a CONTINUATION of an ongoing quiz session. Evaluate the user's answer."}

**STRICT DECISION RULES:**
1. IF isFirstMessage IS TRUE:
   - Your response MUST be ONLY ONE question
   - DO NOT evaluate, correct, or judge anything
   - DO NOT say "Correct", "Incorrect", or any evaluation
   - Simply ask a relevant, open-ended question about the note content

2. IF isFirstMessage IS FALSE:
   - The user has provided an answer to your previous question
   - Evaluate the user’s answer using one of the following statuses :
		"Correct ✅" → The answer is accurate and relevant.
		"Almost 🤏" → The answer is partially correct or incomplete.
		"Incorrect ❌" → The answer is wrong.
		"Out of scope 🔄" → The answer does not address the question asked.
		"It's ok 😉" → The user explicitly states that they do not know the answer.
   - Give a brief explanation (under 60 words)
   - Ask ONE thoughtful follow-up question

**OUTPUT FORMAT (STRICT):**
Return two parts in this exact order:
1) Your chat response in Markdown (no JSON, no code fences)
2) The delimiter line: <<METADATA_JSON>> (must be preceded by two newlines and followed by a newline)
3) A single valid JSON object with keys "analysis", "weaknesses", "conclusion"

**Example for isFirstMessage=TRUE:**
What is the main concept described in the notes, and how would you apply it in a practical scenario?

<<METADATA_JSON>>
{"analysis":"Session just started, no assessment yet","weaknesses":"","conclusion":"First question asked about core concepts"}

**Example for isFirstMessage=FALSE:**
Correct ✅ You correctly identified that...

<<METADATA_JSON>>
{"analysis":"Student demonstrates understanding of X","weaknesses":"None observed","conclusion":"Good grasp of fundamentals"}

**Rules:**
- Do NOT include the delimiter anywhere else
- The JSON must be valid and use double quotes
- Keep the chat response under 100 words
- Respond in the language of the note content (detect it)
- Use Markdown: **bold**, bullets where helpful

**Context for THIS session:**
Category: ${categoryName}
Note Content:
${note.content}
${isFirstMessage || !previousConclusion ? "" : `\n\nPrevious Session Insight (use ONLY as context, do NOT assume current knowledge):\n${previousConclusion}`}

**Guidelines for metadata fields:**
- "analysis": ONLY concepts the student has explicitly demonstrated in their answers (empty if isFirstMessage=TRUE)
- "weaknesses": ONLY based on incorrect/incomplete answers in THIS session (empty if isFirstMessage=TRUE)
- "conclusion": Actionable insight based on THIS session's performance only (e.g., "Session started" if isFirstMessage=TRUE)`;

		const conversationMessages: OpenRouterMessage[] = [
			{ role: "system", content: systemPrompt },
			...normalizeIncomingMessages(messages),
		];

		// Step 2: Call OpenRouter FIRST (before consuming credits)
		const aiResult = await routeOpenRouterRequest({
			supabase,
			userId: user.id,
			messages: conversationMessages,
			temperature: 0.7,
			stream: true,
			actionType: "QUIZ",
			preferPremium: creditCheck.canUsePremium,
		});

		// Step 3: If OpenRouter fails, return error WITHOUT consuming credit
		if (!aiResult.ok) {
			console.error("OpenRouter request failed:", {
				code: aiResult.code,
				error: aiResult.error,
				userId: user.id,
				hasCredits: creditCheck.hasCredits,
				canUsePremium: creditCheck.canUsePremium,
				source: creditCheck.source,
			});

			return NextResponse.json(
				{
					error: aiResult.error,
					code: aiResult.code,
				},
				{ status: aiResult.status },
			);
		}

		// Step 4: Consume credit ONLY on first message of session
		if (isFirstMessage && creditCheck.source !== "byok") {
			const consumptionResult = await consumeCredit(
				user.id,
				creditCheck.canUsePremium,
			);
			if (!consumptionResult.success) {
				console.error("Failed to consume credit:", consumptionResult.message);
			}
		}

		// Step 5: Return successful response
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
