import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const OPENROUTER_DEV_API_KEY =
	process.env.OPENROUTER_DEV_API_KEY || process.env.OPENROUTER_PROD_API_KEY;
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

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
Category: ${categoryName}
Note Content:
${note.content}
${previousConclusion ? `\n\nPrevious Session Insight (use ONLY as context, do NOT assume current knowledge):\n${previousConclusion}` : ""}

**Guidelines for "chat_response":**
- If this is the first message: ask ONE relevant, open-ended question about the note content
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
						"X-Model-Used": model,
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
