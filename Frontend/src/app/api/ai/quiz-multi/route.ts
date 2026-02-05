import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// List of free models to rotate through
// NOTE: Avoid reasoning models (r1, r1t) as they expose chain-of-thought
const FREE_MODELS = [
	"google/gemini-2.0-flash-exp:free",
	"meta-llama/llama-3.2-3b-instruct:free",
	"qwen/qwen-2-7b-instruct:free",
	"microsoft/phi-3-mini-128k-instruct:free",
	"z-ai/glm-4.5-air:free",
	"openai/gpt-oss-120b:free",
	"stepfun/step-3.5-flash:free",
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

		// Fetch last study session for these notes to get previous AI feedback
		const { data: lastSession } = await supabase
			.from("study_sessions")
			.select("ai_feedback")
			.overlaps("note_ids", noteIds)
			.eq("user_id", user.id)
			.order("created_at", { ascending: false })
			.limit(1)
			.single();

		let previousConclusion = "";
		if (lastSession?.ai_feedback) {
			try {
				const feedback = JSON.parse(lastSession.ai_feedback);
				previousConclusion = feedback.conclusion || "";
			} catch (e) {
				// Ignore parse errors
			}
		}

		// Combine all notes content
		const combinedContent = notes
			.map((note) => `**${note.title}**\n${note.content}`)
			.join("\n\n---\n\n");

		// Prepare system prompt with JSON response format
		const systemPrompt = `You are a helpful AI tutor helping students review and connect multiple study notes through interactive conversation.

**CRITICAL INSTRUCTIONS:**
1. Your response MUST be ONLY valid JSON - NO extra text before or after
2. DO NOT include your internal reasoning, thinking process, or chain-of-thought
3. DO NOT make assumptions about the student's knowledge unless they explicitly demonstrate it in their answers
4. ONLY base your assessment on: the provided note content + the student's actual responses in THIS session

**Required JSON structure:**
{
  "chat_response": "Your conversational response (use Markdown)",
  "analysis": "What the student has demonstrated understanding of in THIS session",
  "weaknesses": "Gaps identified based on THIS session's answers only",
  "conclusion": "Strategic insight for future AI sessions based on THIS session only"
}

**Context for THIS session:**
The student has selected ${notes.length} note${notes.length > 1 ? "s" : ""} from category_id: ${categoryId || "mixed categories"}.

Combined Note Content:
${combinedContent}
${previousConclusion ? `\n\nPrevious Session Insight (use ONLY as context, do NOT assume current knowledge):\n${previousConclusion}` : ""}

**Guidelines for "chat_response":**
- If this is the first message: ask ONE relevant, open-ended question that tests understanding across the selected notes
- Help the student connect ideas between notes (concepts, themes, contrasts)
- Respond in the same language as the student's last message
- Use Markdown: **bold**, bullets where helpful
- If the student answered, follow this structure:
  1. Start with: "Correct ✅" / "Almost 🤏" / "Incorrect ❌"
  2. Brief explanation (under 60 words, use Markdown)
  3. Ask ONE thoughtful follow-up question
- Be conversational, encouraging, focused
- Keep "chat_response" under 100 words
- DO NOT expose your reasoning process

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

				// Parse stream and extract chat_response for streaming
				const encoder = new TextEncoder();
				const stream = new ReadableStream({
					async start(controller) {
						const reader = response.body?.getReader();
						const decoder = new TextDecoder();
						if (!reader) {
							controller.close();
							return;
						}

						let fullResponse = "";
						let jsonData = { analysis: "", weaknesses: "", conclusion: "" };

						try {
							while (true) {
								const { done, value } = await reader.read();
								if (done) {
									// Send final metadata as JSON chunk
									const metaChunk = `data: ${JSON.stringify({ type: "metadata", data: jsonData })}\n\n`;
									controller.enqueue(encoder.encode(metaChunk));
									controller.enqueue(encoder.encode("data: [DONE]\n\n"));
									break;
								}

								const chunk = decoder.decode(value, { stream: true });
								const lines = chunk.split("\n");

								for (const line of lines) {
									if (line.startsWith("data: ")) {
										const data = line.slice(6);
										if (data === "[DONE]") continue;

										try {
											const parsed = JSON.parse(data);
											const content = parsed.choices?.[0]?.delta?.content;

											if (content) {
												fullResponse += content;

												// Try to parse accumulated JSON
												const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
												if (jsonMatch) {
													try {
														const jsonObj = JSON.parse(jsonMatch[0]);
														// Store metadata
														jsonData = {
															analysis: jsonObj.analysis || "",
															weaknesses: jsonObj.weaknesses || "",
															conclusion: jsonObj.conclusion || ""
														};

														// Stream only chat_response content
														if (jsonObj.chat_response) {
															const chatPart = jsonObj.chat_response.substring(
																fullResponse.lastIndexOf(jsonObj.chat_response) === -1 ? 0 : 
																fullResponse.split(jsonObj.chat_response)[0].length
															);
															
															if (chatPart) {
																const streamChunk = `data: ${JSON.stringify({ 
																	choices: [{ delta: { content: chatPart } }] 
																})}\n\n`;
																controller.enqueue(encoder.encode(streamChunk));
															}
														}
													} catch (e) {
														// Partial JSON, keep accumulating
													}
												} else {
													// Forward raw content if no JSON detected yet
													controller.enqueue(encoder.encode(line + "\n"));
												}
											}
										} catch (e) {
											// Forward unparseable lines as-is
											controller.enqueue(encoder.encode(line + "\n"));
										}
									}
								}
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
						"X-Model-Used": model,
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
