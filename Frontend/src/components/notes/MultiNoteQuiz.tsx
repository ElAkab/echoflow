"use client";

import { useState, useEffect, useRef } from "react";
import { Markdown } from "@/components/ui/markdown";
import { TokenWarning, type TokenWarningProps } from "@/components/TokenWarning";
import { readSSEStream, type StreamMetadata } from "@/lib/ai/sse";
import { useFeedbackStore } from "@/lib/store/feedback-store";
import { useCreditsStore } from "@/lib/store/credits-store";
import { Loader2 } from "lucide-react";

interface Message {
	role: "user" | "assistant";
	content: string;
}

interface MultiNoteQuizProps {
	noteIds: string[];
	onClose: () => void;
}

export function MultiNoteQuiz({ noteIds, onClose }: MultiNoteQuizProps) {
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [loading, setLoading] = useState(false);
	const [isStreaming, setIsStreaming] = useState(false);
	const [hasStarted, setHasStarted] = useState(false);
	const [startTime] = useState(Date.now());
	const [modelUsed, setModelUsed] = useState("unknown");
	const [keySource, setKeySource] = useState("unknown");
	const [isSaving, setIsSaving] = useState(false);
	const lastFeedbackRef = useRef<StreamMetadata>({ analysis: "", weaknesses: "", conclusion: "" });
	const [errorState, setErrorState] = useState<{
		type: TokenWarningProps["errorType"];
		message?: string;
	} | null>(null);
	const refreshCredits = useCreditsStore((state) => state.refreshCredits);

	// Auto-start quiz when component mounts
	useEffect(() => {
		if (!hasStarted) {
			startQuiz();
		}
	}, []);

	const mapErrorCode = (
		code?: string | number,
	): TokenWarningProps["errorType"] => {
		const normalized = (code ?? "").toString().toLowerCase();

		if (normalized.includes("platform_budget_exhausted")) {
			return "platform_budget_exhausted";
		}

		if (normalized.includes("byok_or_upgrade_required")) {
			return "byok_or_upgrade_required";
		}

		if (
			normalized.includes("quota") ||
			normalized.includes("insufficient")
		) {
			return "quota_exhausted";
		}

		if (normalized.includes("rate")) return "rate_limit";

		if (normalized.includes("invalid_api_key") || normalized.includes("user not found")) {
			return "invalid_api_key";
		}

		if (
			normalized.includes("all_models_failed") ||
			normalized.includes("no_models")
		) {
			return "no_models_available";
		}

		return "generic";
	};

	const processStream = async (
		response: Response,
		updatedMessages: Message[],
	) => {
		let accumulatedContent = "";
		let metadata: StreamMetadata = {
			analysis: "",
			weaknesses: "",
			conclusion: "",
		};

		try {
			setIsStreaming(true);
			
			await readSSEStream(response, {
				onDelta: (content) => {
					accumulatedContent += content;

					// Use functional update to ensure we always have latest state
					setMessages((prev) => {
						const baseMessages = updatedMessages || prev;
						const lastMessage = baseMessages[baseMessages.length - 1];

						if (lastMessage?.role === "assistant") {
							// Update existing assistant message
							return [
								...baseMessages.slice(0, -1),
								{ role: "assistant", content: accumulatedContent },
							];
						}

						// Add new assistant message
						return [
							...baseMessages,
							{ role: "assistant", content: accumulatedContent },
						];
					});
				},
				onMetadata: (data) => {
					metadata = data;
				},
				onDone: () => {
					if (!accumulatedContent.trim()) {
						setErrorState({
							type: "generic",
							message: "Empty response received from the AI model.",
						});
						setLoading(false);
						setIsStreaming(false);
						return;
					}

					// Final update with complete content
					setMessages((prev) => {
						const baseMessages = updatedMessages || prev;
						const lastMessage = baseMessages[baseMessages.length - 1];

						if (lastMessage?.role === "assistant") {
							return [
								...baseMessages.slice(0, -1),
								{ role: "assistant", content: accumulatedContent },
							];
						}

						return [
							...baseMessages,
							{ role: "assistant", content: accumulatedContent },
						];
					});

					lastFeedbackRef.current = metadata;
					setLoading(false);
					setIsStreaming(false);
				},
			});
		} catch (error) {
			console.error("Stream processing error:", error);
			setErrorState({
				type: "generic",
				message: "Streaming failed. Please try again.",
			});
			setLoading(false);
			setIsStreaming(false);
		}
	};

	const startQuiz = async () => {
		setHasStarted(true);
		setLoading(true);
		setIsStreaming(false);
		setErrorState(null);

		try {
			const res = await fetch("/api/ai/quiz-multi", {
				method: "POST",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ noteIds, messages: [] }),
			});

			if (!res.ok) {
				let errorBody: any = null;
				try {
					errorBody = await res.json();
				} catch (e) {
					console.error("Quiz start error:", e);
				}

				console.error("AI backend error:", {
					code: errorBody?.code || null,
					message: errorBody?.error || errorBody?.message || res.statusText,
					status: res.status,
				});

				setLoading(false);
				setErrorState({
					type: mapErrorCode(errorBody?.code),
					message: errorBody?.error || errorBody?.message || res.statusText,
				});
				return;
			}

			const responseModel = res.headers.get("X-Model-Used");
			if (responseModel) {
				setModelUsed(responseModel);
			}
			const responseKeySource = res.headers.get("X-Key-Source");
			if (responseKeySource) {
				setKeySource(responseKeySource);
			}

			await processStream(res, []);
		} catch (error) {
			console.error("Failed to start quiz:", error);
			setErrorState({
				type: "generic",
				message: "Failed to start quiz.",
			});
		} finally {
			setLoading(false);
		}
	};

	const sendMessage = async () => {
		if (!input.trim()) return;

		const userMessage: Message = { role: "user", content: input };
		const updatedMessages = [...messages, userMessage];
		setMessages(updatedMessages);
		setInput("");
		setLoading(true);
		setIsStreaming(false);
		setErrorState(null);

		try {
			const res = await fetch("/api/ai/quiz-multi", {
				method: "POST",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					noteIds,
					messages: updatedMessages.map((m) => ({
						role: m.role,
						content: m.content,
					})),
				}),
			});

			if (!res.ok) {
				let errorBody: any = null;
				try {
					errorBody = await res.json();
				} catch (e) {
					console.error("Send message error:", e);
				}

				console.error("AI backend error:", {
					code: errorBody?.code || null,
					message: errorBody?.error || errorBody?.message || res.statusText,
					status: res.status,
				});

				setLoading(false);
				setErrorState({
					type: mapErrorCode(errorBody?.code),
					message: errorBody?.error || errorBody?.message || res.statusText,
				});
				return;
			}

			const responseModel = res.headers.get("X-Model-Used");
			if (responseModel) {
				setModelUsed(responseModel);
			}
			const responseKeySource = res.headers.get("X-Key-Source");
			if (responseKeySource) {
				setKeySource(responseKeySource);
			}

			await processStream(res, updatedMessages);
		} catch (error) {
			console.error("Failed to send message:", error);
			setErrorState({
				type: "generic",
				message: "Failed to send message.",
			});
		} finally {
			setLoading(false);
		}
	};

	const isBlockingError =
		errorState?.type === "quota_exhausted" ||
		errorState?.type === "platform_budget_exhausted" ||
		errorState?.type === "byok_or_upgrade_required" ||
		errorState?.type === "invalid_api_key" ||
		errorState?.type === "no_models_available";

	// Determine if we should show the "AI is thinking" indicator
	const showThinkingIndicator = loading && !isStreaming && !errorState;

	// Derive quiz phase from conversation history (mirrors server-side logic)
	const assistantTurns = messages.filter((m) => m.role === "assistant").length;
	const quizPhase: "focused" | "synthesis" =
		noteIds.length <= 1 || assistantTurns < noteIds.length ? "focused" : "synthesis";

	// Handle close with proper async save
	const handleClose = async () => {
		if (isSaving) return;
		// Don't save if the user never answered anything
		if (!messages.some((m) => m.role === "user")) {
			refreshCredits();
			useFeedbackStore.getState().triggerFeedback();
			onClose();
			return;
		}

		setIsSaving(true);

		const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
		const questionsAsked = messages.filter((m) => m.role === "assistant").length;
		const lastFeedback = lastFeedbackRef.current;

		try {
			const firstNoteRes = await fetch(`/api/notes/${noteIds[0]}`);
			const firstNote = await firstNoteRes.json();
			const categoryId = firstNote?.category_id || null;

			await fetch("/api/study-sessions", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					noteIds,
					categoryId,
					sessionType: "MULTI_NOTE",
					modelUsed: `${keySource}:${modelUsed}`,
					conversationHistory: messages,
					aiFeedback: JSON.stringify(lastFeedback),
					questionsAsked,
					durationSeconds,
				}),
			});
		} catch (error) {
			console.error("Failed to save study session:", error);
		} finally {
			// Always refresh credits on close — credit was consumed server-side
			// on the first message regardless of whether session saving succeeded.
			refreshCredits();
			setIsSaving(false);
			useFeedbackStore.getState().triggerFeedback();
			onClose();
		}
	};

	if (!hasStarted) {
		return (
			<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
				<div className="bg-white rounded-lg shadow-xl p-8 max-w-md">
					<h2 className="text-2xl font-bold mb-4">Ready to Study?</h2>
					<p className="text-gray-600 mb-6">
						You&apos;ve selected {noteIds.length} note{noteIds.length > 1 ? "s" : ""}
						. The AI will quiz you on the content.
					</p>
					<div className="flex gap-3">
						<button
							onClick={startQuiz}
							disabled={loading}
							className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
						>
							{loading ? "Starting..." : "Start Quiz"}
						</button>
						<button
							onClick={onClose}
							className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 cursor-pointer"
						>
							Cancel
						</button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
			<div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
					{isBlockingError ? (
						<div className="space-y-4">
							<TokenWarning
								errorType={errorState?.type}
								customMessage={errorState?.message}
								onRetryLater={() => {
									setErrorState(null);
									startQuiz();
								}}
							/>
						</div>
					) : (
					<>
						{/* Header */}
						<div className="flex justify-between items-center p-4 border-b">
							<div className="flex items-center gap-2">
								<h2 className="text-xl font-semibold">
									AI Study Session ({noteIds.length} note{noteIds.length > 1 ? "s" : ""})
								</h2>
								{noteIds.length > 1 && (
									<span
										className={`text-xs px-2 py-0.5 rounded-full font-medium ${
											quizPhase === "focused"
												? "bg-blue-100 text-blue-700"
												: "bg-purple-100 text-purple-700"
										}`}
									>
										{quizPhase === "focused"
											? `Note ${Math.min(assistantTurns + 1, noteIds.length)} / ${noteIds.length}`
											: "Synthesis ✦"}
									</span>
								)}
							</div>
							<button
								onClick={handleClose}
								disabled={isSaving}
								className="px-3 py-1 text-gray-600 hover:text-gray-800 cursor-pointer disabled:opacity-50"
							>
								{isSaving ? "Saving..." : "✕ Close"}
							</button>
						</div>

						{/* Messages */}
						<div className="flex-1 overflow-y-auto p-4 space-y-4">
							{messages.map((msg, idx) => (
								<div
									key={idx}
									className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
								>
									<div
										className={`max-w-[80%] px-4 py-2 rounded-lg ${
											msg.role === "user"
												? "bg-blue-600 text-white"
												: "bg-gray-200 text-gray-900"
										}`}
									>
										{msg.role === "assistant" ? (
											<Markdown content={msg.content} />
										) : (
											<p className="whitespace-pre-wrap">{msg.content}</p>
										)}
									</div>
								</div>
							))}
							
							{/* AI Thinking Indicator */}
							{showThinkingIndicator && (
								<div className="flex justify-start">
									<div className="bg-gray-200 text-gray-900 px-4 py-2 rounded-lg flex items-center gap-2">
										<Loader2 className="h-4 w-4 animate-spin" />
										<span>L&apos;IA r&eacute;fl&eacute;chit...</span>
									</div>
								</div>
							)}

							{/* If not loading and no meaningful assistant response, show TokenWarning */}
							{(() => {
								const lastMessage = messages[messages.length - 1];
								const noAssistantResponse =
									messages.length === 0 ||
									(lastMessage?.role === "assistant" &&
										lastMessage.content.trim() === "") ||
									lastMessage?.role === "user";

								if (
									!loading &&
									!isBlockingError &&
									errorState &&
									noAssistantResponse
								) {
									return (
										<TokenWarning
											errorType={errorState.type}
											variant="inline"
											customMessage={errorState.message}
											onRetryLater={() => {
												setErrorState(null);
												startQuiz();
											}}
										/>
									);
								}

								return null;
							})()}
						</div>

						{/* Input */}
						<div className="p-4 border-t">
							<div className="flex gap-2">
								<textarea
									value={input}
									onChange={(e) => setInput(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter" && !e.shiftKey) {
											e.preventDefault();
											sendMessage();
										}
									}}
									placeholder="Type your answer here... (Shift+Enter for new line)"
									className="flex-1 px-3 py-2 border border-gray-300 rounded-lg resize-none"
									rows={3}
									disabled={loading}
								/>
								<button
									onClick={sendMessage}
									disabled={loading || !input.trim()}
									className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
								>
									Send
								</button>
							</div>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
