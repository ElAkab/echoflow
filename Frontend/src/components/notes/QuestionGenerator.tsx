"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/ui/markdown";
import {
	TokenWarning,
	type TokenWarningProps,
} from "@/components/TokenWarning";
import { readSSEStream, type StreamMetadata } from "@/lib/ai/sse";
import { useFeedbackStore } from "@/lib/store/feedback-store";
import { useCreditsStore } from "@/lib/store/credits-store";

interface Message {
	role: "user" | "assistant";
	content: string;
}

interface QuestionGeneratorProps {
	noteId?: string;
	noteIds?: string[];
	variant?: "default" | "compact";
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}

export function QuestionGenerator({
	noteId,
	noteIds,
	variant = "default",
	open,
	onOpenChange,
}: QuestionGeneratorProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [loading, setLoading] = useState(false);
	const [isStreaming, setIsStreaming] = useState(false);
	const [currentModel, setCurrentModel] = useState<string>("unknown");
	const [currentKeySource, setCurrentKeySource] = useState<string>("unknown");
	const [categoryId, setCategoryId] = useState<string | undefined>();
	const [sessionStartTime, setSessionStartTime] = useState<number>(0);
	const [errorState, setErrorState] = useState<{
		type: TokenWarningProps["errorType"];
		message?: string;
	} | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const wasOpenRef = useRef(false);
	const hasSavedRef = useRef(false);
	const refreshCredits = useCreditsStore((state) => state.refreshCredits);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

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

		if (normalized.includes("quota") || normalized.includes("insufficient")) {
			return "quota_exhausted";
		}

		if (normalized.includes("rate")) return "rate_limit";

		if (
			normalized.includes("invalid_api_key") ||
			normalized.includes("user not found")
		) {
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

	useEffect(() => {
		scrollToBottom();
	}, [messages]);

	// Support controlled `open` prop
	useEffect(() => {
		if (open !== undefined) setIsOpen(open);
	}, [open]);

	// Auto-start conversation when controlled `open` becomes true
	useEffect(() => {
		if (open !== undefined && open) {
			if (!loading && messages.length === 0) {
				setSessionStartTime(Date.now());
				hasSavedRef.current = false;
				startConversation().catch((e) => console.error(e));
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	// Track dialog open state for save-on-close
	useEffect(() => {
		if (wasOpenRef.current && !isOpen) {
			saveSession();
		}
		wasOpenRef.current = isOpen;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOpen]);

	// Save study session when dialog closes
	const saveSession = useCallback(async () => {
		if (hasSavedRef.current) return;
		if (messages.length === 0) return;

		const noteIdsToSave = noteIds || (noteId ? [noteId] : []);
		if (noteIdsToSave.length === 0) return;

		setIsSaving(true);
		hasSavedRef.current = true;

		const durationSeconds =
			sessionStartTime > 0
				? Math.floor((Date.now() - sessionStartTime) / 1000)
				: 0;

		const lastFeedback = (window as any).__lastAIFeedback || {};
		const aiFeedback = JSON.stringify(lastFeedback);

		try {
			await fetch("/api/study-sessions", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					noteIds: noteIdsToSave,
					categoryId,
					sessionType:
						noteIds && noteIds.length > 1 ? "MULTI_NOTE" : "SINGLE_NOTE",
					modelUsed: `${currentKeySource}:${currentModel}`,
					conversationHistory: messages,
					aiFeedback,
					questionsAsked: messages.filter((m) => m.role === "assistant").length,
					durationSeconds,
				}),
			});
		} catch (error) {
			console.error("Failed to save study session:", error);
			hasSavedRef.current = false;
		} finally {
			// Always refresh credits on close when a session was started —
			// the credit was consumed server-side on the first message regardless
			// of whether session saving succeeded.
			refreshCredits();
			setIsSaving(false);
		}
	}, [
		messages,
		noteId,
		noteIds,
		categoryId,
		currentModel,
		currentKeySource,
		sessionStartTime,
		refreshCredits,
	]);

	const setOpen = (val: boolean) => {
		if (onOpenChange) onOpenChange(val);
		if (open === undefined) setIsOpen(val);

		if (!val) {
			useFeedbackStore.getState().triggerFeedback();
		}
	};

	const processStream = async (
		response: Response,
		updatedMessages?: Message[],
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

					(window as any).__lastAIFeedback = metadata;
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

	const startConversation = async () => {
		console.debug("QuestionGenerator: startConversation called", {
			noteId,
			noteIds,
		});
		setOpen(true);
		setMessages([]);
		setLoading(true);
		setIsStreaming(false);
		setErrorState(null);

		try {
			let fetchedCategoryId: string | undefined;

			if (noteId) {
				const noteRes = await fetch(`/api/notes/${noteId}`);
				if (noteRes.ok) {
					const noteData = await noteRes.json();
					fetchedCategoryId = noteData.category_id;
					setCategoryId(fetchedCategoryId);
				}
			} else if (noteIds && noteIds.length > 0) {
				const noteRes = await fetch(`/api/notes/${noteIds[0]}`);
				if (noteRes.ok) {
					const noteData = await noteRes.json();
					fetchedCategoryId = noteData.category_id;
					setCategoryId(fetchedCategoryId);
				}
			}

			const endpoint =
				noteIds && noteIds.length > 1
					? "/api/ai/quiz-multi"
					: "/api/ai/generate-questions";

			const body =
				noteIds && noteIds.length > 1
					? { noteIds, messages: [] }
					: { noteId, messages: [] };

			console.debug("QuestionGenerator: fetching", endpoint, body);
			const res = await fetch(endpoint, {
				method: "POST",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});

			console.debug("QuestionGenerator: fetch complete", res.status);

			if (!res.ok) {
				let errorBody: any = null;
				try {
					errorBody = await res.json();
				} catch (e) {}

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

			const modelUsed = res.headers.get("X-Model-Used");
			if (modelUsed) {
				setCurrentModel(modelUsed);
			}
			const keySource = res.headers.get("X-Key-Source");
			if (keySource) {
				setCurrentKeySource(keySource);
			}

			await processStream(res, []);
		} catch (error) {
			console.error("Failed to start conversation:", error);
			setErrorState({
				type: "generic",
				message: "Failed to start conversation.",
			});
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
			const endpoint =
				noteIds && noteIds.length > 1
					? "/api/ai/quiz-multi"
					: "/api/ai/generate-questions";

			const body =
				noteIds && noteIds.length > 1
					? { noteIds, messages: updatedMessages }
					: { noteId, messages: updatedMessages };

			const res = await fetch(endpoint, {
				method: "POST",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});

			if (!res.ok) {
				let errorBody: any = null;
				try {
					errorBody = await res.json();
				} catch (e) {}

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

			const modelUsed = res.headers.get("X-Model-Used");
			if (modelUsed) {
				setCurrentModel(modelUsed);
			}
			const keySource = res.headers.get("X-Key-Source");
			if (keySource) {
				setCurrentKeySource(keySource);
			}

			await processStream(res, updatedMessages);
		} catch (error) {
			console.error("Failed to send message:", error);
			setErrorState({
				type: "generic",
				message: "Failed to send message.",
			});
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

	return (
		<>
			{variant === "compact" ? (
				<Button
					size="sm"
					variant="ghost"
					className="gap-2 h-8 text-xs bg-white/10 hover:bg-white/20 cursor-pointer"
					onClick={startConversation}
					disabled={loading}
				>
					<Sparkles className="h-3 w-3" />
					Quiz
				</Button>
			) : (
				<Button
					onClick={startConversation}
					disabled={loading}
					className="gap-2"
				>
					<Sparkles className="h-4 w-4 cursor-pointer" />
					{loading ? "Starting..." : "Quiz Me"}
				</Button>
			)}

			<Dialog
				open={isOpen}
				onOpenChange={(val) => {
					if (onOpenChange) onOpenChange(val);
					if (open === undefined) setIsOpen(val);
				}}
			>
				<DialogContent
					className="sm:max-w-[700px] max-h-[85vh] flex flex-col"
					suppressHydrationWarning
				>
					<DialogHeader>
						<DialogTitle>AI Study Session</DialogTitle>
					</DialogHeader>

					{isBlockingError ? (
						<div className="space-y-4">
							<TokenWarning
								errorType={errorState?.type}
								customMessage={errorState?.message}
								onRetryLater={() => {
									setErrorState(null);
									startConversation();
								}}
							/>
						</div>
					) : (
						<>
							{/* Messages */}
							<div className="flex-1 overflow-y-auto space-y-4 py-4">
								{messages.map((msg, idx) => (
									<div
										key={idx}
										className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
									>
										<div
											className={`max-w-[85%] px-4 py-3 rounded-lg ${
												msg.role === "user"
													? "bg-primary text-primary-foreground"
													: "bg-muted text-foreground"
											}`}
										>
											{msg.role === "assistant" ? (
												<Markdown content={msg.content} />
											) : (
												<p className="text-sm whitespace-pre-wrap">
													{msg.content}
												</p>
											)}
										</div>
									</div>
								))}

								{/* AI Thinking Indicator - shows when waiting for response but not yet streaming */}
								{showThinkingIndicator && (
									<div className="flex justify-start">
										<div className="bg-muted text-foreground px-4 py-3 rounded-lg flex items-center gap-2">
											<Loader2 className="h-4 w-4 animate-spin" />
											<span className="text-sm">Thinking...</span>
										</div>
									</div>
								)}

								{/* Show TokenWarning when not loading and there is no response */}
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
													startConversation();
												}}
											/>
										);
									}

									return null;
								})()}

								<div ref={messagesEndRef} />
							</div>

							{/* Input */}
							<div className="border-t pt-4 space-y-3">
								<Textarea
									value={input}
									onChange={(e) => setInput(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter" && !e.shiftKey) {
											e.preventDefault();
											sendMessage();
										}
									}}
									placeholder="Type your answer... (Shift+Enter for new line)"
									className="resize-none min-h-[100px]"
									disabled={loading}
								/>
								<div className="flex justify-end gap-2">
									<Button
										variant="outline"
										onClick={() => setOpen(false)}
										disabled={isSaving}
										className="cursor-pointer"
									>
										{isSaving ? "Saving..." : "Close"}
									</Button>
									<Button
										onClick={sendMessage}
										disabled={loading || !input.trim()}
										className="cursor-pointer"
									>
										Send
									</Button>
								</div>
								<span className="text-sm text-muted-foreground text-center block">
									Don&apos;t trust the AI completely.
								</span>
							</div>
						</>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}
