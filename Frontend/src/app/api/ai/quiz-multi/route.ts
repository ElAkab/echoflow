import { streamOpenRouterResponse } from "@/app/api/ai/_utils/openrouter-stream";
import {
	routeOpenRouterRequest,
	type OpenRouterMessage,
} from "@/app/api/ai/_utils/openrouter-routing";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

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

			// Check credits availability
			const { checkCredits, consumeCredit } = await import("@/lib/credits");
			const creditCheck = await checkCredits(user.id);
			if (!creditCheck.hasCredits) {
				return NextResponse.json(
					{
						error: "Insufficient credits",
						code: "credits_exhausted",
						message: "You don't have enough credits. Buy more Study Questions or use your own OpenRouter key.",
					},
					{ status: 403 },
				);
			}

			const { noteIds, messages } = await request.json();

			// Check if this is the first message of a session
			const isFirstMessage = !messages || messages.length === 0;

			// Deterministic note rotation: count assistant turns already in history.
			// assistantTurns=0 → Note 0, assistantTurns=1 → Note 1, etc.
			const rawMessages = Array.isArray(messages) ? messages : [];
			const assistantTurns = rawMessages.filter(
				(m: unknown) =>
					m !== null &&
					typeof m === "object" &&
					(m as Record<string, unknown>).role === "assistant",
			).length;

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

			let feedback: unknown = session.ai_feedback;
			if (typeof feedback === "string") {
				try {
					feedback = JSON.parse(feedback);
				} catch {
					continue;
				}
			}

			if (!feedback || typeof feedback !== "object") continue;
			const feedbackRecord = feedback as Record<string, unknown>;
			const conclusion =
				typeof feedbackRecord.conclusion === "string"
					? feedbackRecord.conclusion
					: "";
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

		// Only include previous insights if this is NOT the first message
		// For the first message, we want a fresh start without previous context pollution
		let previousInsightsBlock = "";
		if (!isFirstMessage) {
			const insightLines = noteIds
				.map((noteId) => {
					const conclusion = conclusionByNote.get(noteId);
					if (!conclusion) return null;
					const title = noteTitleMap.get(noteId) || "Untitled note";
					return `- ${title}: ${conclusion}`;
				})
				.filter(Boolean);
			
			if (insightLines.length > 0) {
				previousInsightsBlock = `\n\nPrevious Session Insights (per note, use ONLY as context, do NOT assume current knowledge):\n${insightLines.join("\n")}`;
			}
		}

		// ── Phase detection ───────────────────────────────────────────────────────
		// Phase A — FOCUSED  : one question per note (turns 0..N-1)
		// Phase B — SYNTHESIS: cross-note questions once all notes covered (turns N+)
		const targetNoteIdx = notes.length > 1 ? assistantTurns % notes.length : 0;
		const targetNote = notes[targetNoteIdx];
		const phase: "focused" | "synthesis" =
			notes.length <= 1 || assistantTurns < notes.length ? "focused" : "synthesis";

		// ── Adaptive context builder ───────────────────────────────────────────
		// Phase A: inject ONLY the target note (full content) — keeps tokens low.
		// Phase B: inject compact summaries of ALL notes so the LLM can draw
		//          explicit connections without drowning in raw text.

		function extractExcerpt(content: string, maxWords: number): string {
			const words = content.split(/\s+/).filter(Boolean);
			if (words.length <= maxWords) return content;
			return words.slice(0, maxWords).join(" ") + "…";
		}

		function extractHeadings(content: string): string {
			const headings = content.match(/^#{1,3}\s+.+$/gm) ?? [];
			return headings
				.map((h) => h.replace(/^#{1,3}\s+/, "").trim())
				.join(", ");
		}

		let noteContext: string;
		let phaseHeader: string;

		if (phase === "focused") {
			noteContext = targetNote.content;
			phaseHeader = notes.length > 1
				? `**SESSION PHASE: Note Coverage** (turn ${assistantTurns + 1} / ${notes.length})\nCurrent target: **"${targetNote.title}"** (Note ${targetNoteIdx + 1} of ${notes.length})`
				: `**Note:** "${targetNote.title}"`;
		} else {
			const noteIndex = notes.map((n, i) => `${i + 1}. "${n.title}"`).join(" | ");
			noteContext = notes
				.map((n, i) => {
					const headings = extractHeadings(n.content);
					const excerpt = extractExcerpt(n.content, 100);
					return `**Note ${i + 1}: ${n.title}**${headings ? `\nSections: ${headings}` : ""}\n${excerpt}`;
				})
				.join("\n\n---\n\n");
			phaseHeader = `**SESSION PHASE: Cross-Note Synthesis** (all ${notes.length} notes individually covered)\nNotes in this session: ${noteIndex}`;
		}

		// ── Phase-specific instructions ────────────────────────────────────────
		const phaseInstructions =
			phase === "focused"
				? `Your question MUST be specifically about: **"${targetNote.title}"**
Do NOT ask about other notes in this turn.`
				: `Your question MUST explicitly connect concepts from at least two notes.
Name the notes by title in your question (e.g. "How does X from **Note 1** relate to Y in **Note 2**?").
Do NOT ask a question that could apply to a single note alone.`;

		// ── System prompt ──────────────────────────────────────────────────────
		const systemPrompt = `You are a helpful AI tutor helping students review and connect multiple study notes through interactive conversation.

${phaseHeader}

**isFirstMessage: ${isFirstMessage ? "TRUE" : "FALSE"}**
${isFirstMessage ? "→ START of quiz session: ask your first question." : "→ CONTINUATION: evaluate the user's answer, then ask the next question."}

**QUESTION RULES FOR THIS TURN:**
${phaseInstructions}

**TURN STRUCTURE:**
1. IF isFirstMessage IS TRUE:
   - ONE question only — no evaluation, no preamble
   - Do NOT say "Correct", "Incorrect", or any variant

2. IF isFirstMessage IS FALSE:
   - Evaluate the user's answer: "Correct ✅" / "Almost 🤏" / "Incorrect ❌"
   - Brief explanation (under 60 words)
   - ONE follow-up question following the QUESTION RULES above

**OUTPUT FORMAT (required):**
[Your markdown response — under 120 words]

<<METADATA_JSON>>
{"analysis":"...","weaknesses":"...","conclusion":"..."}

Rules: no delimiter elsewhere · valid JSON · respond in the note's language · use **bold** and bullets where helpful

**NOTE CONTENT:**
${noteContext}
${isFirstMessage ? "" : previousInsightsBlock}

**Metadata guidelines:**
- "analysis": concepts the student demonstrated (empty if isFirstMessage=TRUE)
- "weaknesses": gaps or errors in THIS session (empty if isFirstMessage=TRUE)
- "conclusion": actionable insight from THIS session ("Session started — first question asked" if isFirstMessage=TRUE)`;

		// Build conversation history
		const aiMessages: OpenRouterMessage[] = [
			{ role: "system", content: systemPrompt },
			...normalizeIncomingMessages(messages),
		];

		const aiResult = await routeOpenRouterRequest({
			supabase,
			userId: user.id,
			messages: aiMessages,
			temperature: 0.7,
			maxTokens: 800, // 500 was too low — could truncate before <<METADATA_JSON>> delimiter
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

		// Consume credit ONLY on first message of session (not on subsequent messages)
		if (isFirstMessage && creditCheck.source !== "byok") {
			const consumptionResult = await consumeCredit(user.id, creditCheck.canUsePremium);
			if (!consumptionResult.success) {
				console.error("Failed to consume credit:", consumptionResult.message);
			}
		}

		return streamOpenRouterResponse(
			aiResult.response,
			aiResult.model,
			aiResult.keySource,
		);
	} catch (error: unknown) {
		const message =
			error instanceof Error ? error.message : "Failed to generate response";
		console.error("Error in quiz-multi:", error);
		return NextResponse.json(
			{ error: message },
			{ status: 500 },
		);
	}
}
