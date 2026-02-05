import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const OPENROUTER_DEV_API_KEY =
	process.env.OPENROUTER_DEV_API_KEY || process.env.OPENROUTER_PROD_API_KEY;
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

// List of free models to rotate through
const FREE_MODELS = [
	"tngtech/deepseek-r1t2-chimera:free",
	"google/gemini-2.0-flash-exp:free",
	"meta-llama/llama-3.2-3b-instruct:free",
	"qwen/qwen-2-7b-instruct:free",
	"microsoft/phi-3-mini-128k-instruct:free",
	"z-ai/glm-4.5-air:free",
	"tngtech/deepseek-r1t-chimera:free",
	"openai/gpt-oss-120b:free",
	"stepfun/step-3.5-flash:free",
	"openai/gpt-oss-120b:free",
];

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

		// Build conversation messages
		const categoryName = note.categories?.name || "General";
		const systemPrompt = `You are a helpful AI tutor helping students review their study notes through interactive conversation.

**CRITICAL: Your response MUST be valid JSON with this exact structure:**
{
  "chat_response": "Your conversational response (use Markdown)",
  "analysis": "What the student understands about this topic",
  "weaknesses": "Identified gaps or misconceptions",
  "conclusion": "Strategic insight for future AI sessions"
}

Your role:
- Ask thoughtful, open-ended questions about the note content
- Provide feedback on student answers (be encouraging and constructive)
- Help deepen understanding through follow-up questions
- Adapt to the student's level and responses
- Keep responses concise and focused

Category: ${categoryName}
Note Content:
${note.content}

Guidelines for "chat_response":
- If this is the first message, ask ONE relevant question directly
- Respond in the same language as the student's last message
- Use Markdown: **bold**, short bullets

- If the student answered, follow this structure:
  1. Start with: "Correct ✅" / "Almost 🤏" / "Incorrect ❌"
  2. Brief explanation (under 60 words, use Markdown)
  3. Ask ONE follow-up question

- Be conversational, encouraging, focused
- Keep "chat_response" under 100 words

Guidelines for feedback fields:
- "analysis": Specific concepts the student grasped
- "weaknesses": Topics/concepts the student struggles with
- "conclusion": Actionable insight (e.g., "Student ready for topic X", "Needs more practice on Y")
`;

		const conversationMessages = [
			{ role: "system", content: systemPrompt },
			...(messages || []),
		];

		// Call OpenRouter API with model rotation
		if (!OPENROUTER_DEV_API_KEY) {
			return NextResponse.json(
				{ error: "OpenRouter API key not configured" },
				{ status: 500 },
			);
		}

		// Try each model in sequence until one succeeds
		let lastError = null;
		for (const model of FREE_MODELS) {
			try {
				const response = await fetch(
					`${OPENROUTER_BASE_URL}/chat/completions`,
					{
						method: "POST",
						headers: {
							Authorization: `Bearer ${OPENROUTER_DEV_API_KEY}`,
							"Content-Type": "application/json",
							"HTTP-Referer":
								process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
							"X-Title": "Brain Loop",
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
					const errorData = await response.json();
					console.warn(`Model ${model} failed:`, errorData);
					lastError = errorData;
					continue; // Try next model
				}

				// Return the stream directly
				const encoder = new TextEncoder();
				const stream = new ReadableStream({
					async start(controller) {
						const reader = response.body?.getReader();
						if (!reader) {
							controller.close();
							return;
						}

						try {
							while (true) {
								const { done, value } = await reader.read();
								if (done) break;

								// Forward the SSE data
								controller.enqueue(value);
							}
						} catch (error) {
							console.error("Stream error:", error);
						} finally {
							controller.close();
						}
					},
				});

				return new Response(stream, {
					headers: {
						"Content-Type": "text/event-stream",
						"Cache-Control": "no-cache",
						Connection: "keep-alive",
					},
				});
			} catch (error) {
				console.warn(`Model ${model} threw error:`, error);
				lastError = error;
				continue; // Try next model
			}
		}

		// All models failed
		console.error("All models failed. Last error:", lastError);
		return NextResponse.json(
			{
				error:
					"All AI models are currently unavailable. Please try again later.",
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
