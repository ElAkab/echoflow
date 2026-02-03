import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const OPENROUTER_DEV_API_KEY = process.env.OPENROUTER_DEV_API_KEY;
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export async function POST(request: Request) {
	try {
		const supabase = await createClient();

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

		// Build conversation messages
		const categoryName = note.categories?.name || "General";
		const systemPrompt = `You are a helpful AI tutor helping students review their study notes through interactive conversation.

Your role:
- Ask thoughtful, open-ended questions about the note content
- Provide feedback on student answers (be encouraging and constructive)
- Help deepen understanding through follow-up questions
- Adapt to the student's level and responses
- Keep responses concise and focused

Category: ${categoryName}
Note Content:
${note.content}

Guidelines:
- If this is the first message, greet the student and ask a relevant question about the note
- If the student has answered, acknowledge their response and provide constructive feedback
- Ask follow-up questions to deepen understanding
- Be conversational and encouraging
- Keep responses under 100 words`;

		const conversationMessages = [
			{ role: "system", content: systemPrompt },
			...(messages || []),
		];

		// Call OpenRouter API
		if (!OPENROUTER_DEV_API_KEY) {
			return NextResponse.json(
				{ error: "OpenRouter API key not configured" },
				{ status: 500 },
			);
		}

		const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${OPENROUTER_DEV_API_KEY}`,
				"Content-Type": "application/json",
				"HTTP-Referer":
					process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
				"X-Title": "Brain Loop",
			},
			body: JSON.stringify({
				model: "google/gemini-2.0-flash-001:free",
				messages: conversationMessages,
				temperature: 0.7,
				max_tokens: 500,
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error("OpenRouter API error:", errorText);
			return NextResponse.json(
				{ error: `AI service error: ${errorText}` },
				{ status: 500 },
			);
		}

		const data = await response.json();
		const aiResponse = data.choices?.[0]?.message?.content;

		if (!aiResponse) {
			return NextResponse.json(
				{ error: "No response from AI" },
				{ status: 500 },
			);
		}

		return NextResponse.json({ message: aiResponse });
	} catch (error) {
		console.error("AI conversation error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
