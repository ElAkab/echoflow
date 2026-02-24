export type StreamMetadata = {
	analysis: string;
	weaknesses: string;
	conclusion: string;
};

/** Subset sent to the frontend — analysis is server-side only */
export type StreamMetadataPublic = {
	weaknesses: string;
	conclusion: string;
};

export type KeySource = "platform" | "byok";

// Legacy export kept for import compat (quiz-multi imports it)
export const METADATA_DELIMITER = "\n\n<<METADATA_JSON>>\n";

// The actual marker text emitted by the LLM (whitespace around it may vary)
const METADATA_MARKER = "<<METADATA_JSON>>";

const EMPTY_METADATA: StreamMetadata = {
	analysis: "",
	weaknesses: "",
	conclusion: "",
};

function getHoldLength(text: string, delimiter: string): number {
	const maxLen = Math.min(delimiter.length - 1, text.length);
	for (let len = maxLen; len > 0; len -= 1) {
		if (text.endsWith(delimiter.slice(0, len))) return len;
	}
	return 0;
}

function parseMetadata(raw: string): StreamMetadata {
	const trimmed = raw.trim();
	if (!trimmed) return EMPTY_METADATA;

	// Strip markdown code fences (models sometimes wrap JSON despite instructions)
	const stripped = trimmed
		.replace(/^```(?:json)?\s*/i, "")
		.replace(/\s*```\s*$/i, "")
		.trim();

	// Attempt 1: direct parse on stripped text
	for (const candidate of [stripped, trimmed]) {
		try {
			const parsed = JSON.parse(candidate);
			if (parsed && typeof parsed === "object") {
				return {
					analysis: parsed.analysis || "",
					weaknesses: parsed.weaknesses || "",
					conclusion: parsed.conclusion || "",
				};
			}
		} catch {
			// try next candidate
		}
	}

	// Attempt 2: extract first {...} block via regex (handles trailing text)
	const match = stripped.match(/\{[\s\S]*\}/);
	if (match) {
		try {
			const parsed = JSON.parse(match[0]);
			if (parsed && typeof parsed === "object") {
				return {
					analysis: parsed.analysis || "",
					weaknesses: parsed.weaknesses || "",
					conclusion: parsed.conclusion || "",
				};
			}
		} catch {
			// fall through
		}
	}

	console.warn("[parseMetadata] Failed to parse — raw excerpt:", raw.slice(0, 120));
	return EMPTY_METADATA;
}

function enqueueSSE(controller: ReadableStreamDefaultController, data: unknown) {
	const encoder = new TextEncoder();
	controller.enqueue(
		encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
	);
}

function enqueueDone(controller: ReadableStreamDefaultController) {
	const encoder = new TextEncoder();
	controller.enqueue(encoder.encode("data: [DONE]\n\n"));
}

export function streamOpenRouterResponse(
	openRouterResponse: Response,
	modelUsed: string,
	keySource: KeySource = "platform",
): Response {
	const stream = new ReadableStream({
		async start(controller) {
			const reader = openRouterResponse.body?.getReader();
			const decoder = new TextDecoder();

			if (!reader) {
				enqueueSSE(controller, {
					type: "metadata",
					data: { weaknesses: "", conclusion: "" } satisfies StreamMetadataPublic,
				});
				enqueueDone(controller);
				controller.close();
				return;
			}

			let buffer = "";
			let fullText = "";

			// delimiterIndex: index in fullText where chat content ends
			// (trimmed whitespace before <<METADATA_JSON>>)
			let delimiterIndex: number | null = null;

			// markerEndIdx: index right after "<<METADATA_JSON>>" in fullText
			let markerEndIdx: number | null = null;

			let lastSentLength = 0;
			let metadataText = "";
			let doneSent = false;

			const handleContent = (content: string) => {
				if (!content) return;

				fullText += content;

				// Detect marker with flexible surrounding whitespace
				if (delimiterIndex === null) {
					const idx = fullText.indexOf(METADATA_MARKER);
					if (idx !== -1) {
						// Chat content ends before any whitespace that precedes the marker
						delimiterIndex = idx;
						while (
							delimiterIndex > 0 &&
							"\n\r ".includes(fullText[delimiterIndex - 1])
						) {
							delimiterIndex--;
						}
						markerEndIdx = idx + METADATA_MARKER.length;
					}
				}

				const safeEnd =
					delimiterIndex !== null
						? delimiterIndex
						: Math.max(
								0,
								fullText.length - getHoldLength(fullText, METADATA_MARKER),
							);

				if (safeEnd > lastSentLength) {
					const newContent = fullText.slice(lastSentLength, safeEnd);
					lastSentLength = safeEnd;
					enqueueSSE(controller, {
						choices: [{ delta: { content: newContent } }],
					});
				}

				// Build metadata text: skip leading whitespace right after the marker
				if (markerEndIdx !== null) {
					let ms = markerEndIdx;
					while (ms < fullText.length && "\n\r ".includes(fullText[ms])) ms++;
					metadataText = fullText.slice(ms);
				}
			};

			const handleLine = (line: string) => {
				const trimmed = line.trim();
				if (!trimmed.startsWith("data:")) return;
				const payload = trimmed.slice(5).trim();
				if (!payload || payload === "[DONE]") return;

				try {
					const parsed = JSON.parse(payload);
					const content = parsed?.choices?.[0]?.delta?.content;
					if (content) handleContent(content);
				} catch (error) {
					// Ignore malformed JSON chunks
				}
			};

			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split(/\r?\n/);
					buffer = lines.pop() ?? "";

					for (const line of lines) {
						handleLine(line);
					}
				}

				if (buffer.trim()) {
					handleLine(buffer);
				}
			} catch (error) {
				console.error("OpenRouter stream error:", error);
			} finally {
				if (!doneSent) {
					doneSent = true;
					const finalEnd =
						delimiterIndex !== null ? delimiterIndex : fullText.length;
					if (finalEnd > lastSentLength) {
						const remaining = fullText.slice(lastSentLength, finalEnd);
						lastSentLength = finalEnd;
						enqueueSSE(controller, {
							choices: [{ delta: { content: remaining } }],
						});
					}
					const metadata = parseMetadata(metadataText);
					// Send only weaknesses + conclusion to the client.
					// "analysis" is a server-side field used for DB context only —
					// it must never be rendered in the chat UI.
					const publicMetadata: StreamMetadataPublic = {
						weaknesses: metadata.weaknesses,
						conclusion: metadata.conclusion,
					};
					enqueueSSE(controller, { type: "metadata", data: publicMetadata });
					enqueueDone(controller);
					controller.close();
				}
				reader.releaseLock();
			}
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
			"X-Model-Used": modelUsed,
			"X-Key-Source": keySource,
		},
	});
}
