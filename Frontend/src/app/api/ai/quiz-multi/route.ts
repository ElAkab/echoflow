import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

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
					"X-Title": "Brain Loop",
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
		const categoryIds = [...new Set(notes.map(n => n.category_id).filter(Boolean))];
		const categoryId = categoryIds.length === 1 ? categoryIds[0] : null;

		// Combine all notes content
		const combinedContent = notes
			.map((note) => `**${note.title}**\n${note.content}`)
			.join("\n\n---\n\n");

		// Prepare system prompt with JSON response format
		const systemPrompt = `You are a helpful AI tutor helping students review and connect multiple study notes through interactive conversation.

Context:
The student has selected ${notes.length} note${notes.length > 1 ? "s" : ""} from category_id: ${categoryId || "mixed categories"}.

Combined Note Content:
${combinedContent}

**CRITICAL: Your response MUST be valid JSON with this exact structure:**
{
  "chat_response": "Your conversational response to the student (use Markdown)",
  "analysis": "What the student seems to understand so far",
  "weaknesses": "Identified knowledge gaps or misconceptions",
  "conclusion": "Strategic summary for future AI to adapt questions"
}

Your role:
- Ask thoughtful, open-ended questions that test understanding across the selected notes
- Help the student connect ideas between notes (concepts, themes, contrasts)
- Provide feedback on student answers (encouraging and constructive)
- Adapt to the student's level and responses
- Keep responses concise, focused, and progressive

Guidelines for "chat_response":
- If this is the first message, ask directly ONE relevant, brief question that checks the student's understanding
- Always respond in the same language as the student's last message
- Use Markdown formatting (**bold**, short bullets)

- If the student has answered, follow this structure in "chat_response":
  1. Start with one symbolic word: "Correct ✅" / "Almost 🤏" / "Incorrect ❌"
  2. Provide brief explanation (under 60 words)
  3. Ask ONE follow-up question

Guidelines for analysis/weaknesses/conclusion:
- "analysis": Summarize what concepts the student has grasped (be specific)
- "weaknesses": Identify specific topics/concepts the student struggles with
- "conclusion": Actionable insight for next AI session (e.g., "Focus on X concept", "Student ready for advanced Y")

Keep total "chat_response" under 100 words.
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

		let lastError: any = null;
		for (const model of FREE_MODELS) {
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
							"X-Title": "Brain Loop",
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
					// rate limit -> try next model
					if (
						response.status === 429 ||
						(errData && errData.error?.code === 429)
					) {
						console.log(
							`Model ${model} rate limited, switching to next model...`,
						);
						lastError = errData || { status: response.status };
						continue;
					}

					throw new Error(
						JSON.stringify(errData || { status: response.status }),
					);
				}

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
								controller.enqueue(value);
							}
						} catch (err) {
							console.error("Stream error:", err);
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
			} catch (err) {
				console.warn(`Model ${model} threw error:`, err);
				lastError = err;
				continue;
			}
		}

		console.error("All models failed. Last error:", lastError);
		return NextResponse.json(
			{
				error:
					"All AI models are currently unavailable. Please try again later.",
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
