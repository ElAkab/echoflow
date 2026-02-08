"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
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

interface Message {
	role: "user" | "assistant";
	content: string;
}

interface StudySession {
	noteIds: string[];
	categoryId?: string;
	sessionType: "SINGLE_NOTE" | "MULTI_NOTE";
	modelUsed: string;
	conversationHistory: Message[];
	questionsAsked: number;
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
	const [streamingContent, setStreamingContent] = useState("");
	const [currentModel, setCurrentModel] = useState<string>("unknown");
	const [categoryId, setCategoryId] = useState<string | undefined>();
	const [sessionStartTime, setSessionStartTime] = useState<number>(0);
	const [errorState, setErrorState] = useState<{
		type: TokenWarningProps["errorType"];
		message?: string;
	} | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	const mapErrorCode = (
		code?: string | number,
	): TokenWarningProps["errorType"] => {
		const normalized = (code ?? "").toString().toLowerCase();

		if (normalized.includes("quota") || normalized.includes("insufficient")) {
			return "quota_exhausted";
		}

		if (normalized.includes("rate")) return "rate_limit";

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
	}, [messages, streamingContent]);

	// Support controlled `open` prop
	useEffect(() => {
		if (open !== undefined) setIsOpen(open);
	}, [open]);

	// Auto-start conversation when controlled `open` becomes true
	useEffect(() => {
		if (open !== undefined && open) {
			if (!loading && messages.length === 0) {
				// Record session start time
				setSessionStartTime(Date.now());
				// startConversation will set loading and begin the fetch
				startConversation().catch((e) => console.error(e));
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	// Save study session when dialog closes (if there was a conversation)
	useEffect(() => {
		const handleSaveSession = async () => {
			// Only save if closing and there are messages
			if (!isOpen && messages.length > 0) {
				try {
					const noteIdsToSave = noteIds || (noteId ? [noteId] : []);
					if (noteIdsToSave.length === 0) return;

					// Calculate duration
					const durationSeconds =
						sessionStartTime > 0
							? Math.floor((Date.now() - sessionStartTime) / 1000)
							: 0;

					// Get structured AI feedback
					const lastFeedback = (window as any).__lastAIFeedback || {};
					const aiFeedback =
						messages.length > 0 ? JSON.stringify(lastFeedback) : null;

					await fetch("/api/study-sessions", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							noteIds: noteIdsToSave,
							categoryId,
							sessionType:
								noteIds && noteIds.length > 1 ? "MULTI_NOTE" : "SINGLE_NOTE",
							modelUsed: currentModel,
							conversationHistory: messages,
							aiFeedback,
							questionsAsked: messages.filter((m) => m.role === "assistant")
								.length,
							durationSeconds,
						}),
					});
				} catch (error) {
					console.error("Failed to save study session:", error);
				}
			}
		};

		handleSaveSession();
	}, [
		isOpen,
		messages,
		noteId,
		noteIds,
		categoryId,
		currentModel,
		sessionStartTime,
	]);

	const setOpen = (val: boolean) => {
		if (onOpenChange) onOpenChange(val);
		if (open === undefined) setIsOpen(val);
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
			await readSSEStream(response, {
				onDelta: (content) => {
					accumulatedContent += content;
					setStreamingContent(accumulatedContent);
				},
				onMetadata: (data) => {
					metadata = data;
				},
				onDone: () => {
					if (!accumulatedContent.trim()) {
						setStreamingContent("");
						setErrorState({
							type: "generic",
							message: "Empty response received from the AI model.",
						});
						return;
					}

					const assistantMessage: Message = {
						role: "assistant",
						content: accumulatedContent,
					};
					setMessages((prev) => [
						...(updatedMessages || prev),
						assistantMessage,
					]);
					setStreamingContent("");
					(window as any).__lastAIFeedback = metadata;
				},
			});
		} catch (error) {
			console.error("Stream processing error:", error);
			setErrorState({
				type: "generic",
				message: "Streaming failed. Please try again.",
			});
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
		setStreamingContent("");
		setErrorState(null);

		try {
			// Fetch note data to get categoryId and previous session
			let fetchedCategoryId: string | undefined;

			if (noteId) {
				const noteRes = await fetch(`/api/notes/${noteId}`);
				if (noteRes.ok) {
					const noteData = await noteRes.json();
					fetchedCategoryId = noteData.category_id;
					setCategoryId(fetchedCategoryId);
				}
			} else if (noteIds && noteIds.length > 0) {
				// For multi-note, get first note's category
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

			// Debugging: log headers and body availability
			try {
				console.debug(
					"QuestionGenerator: response content-type",
					res.headers.get("content-type"),
				);
				console.debug("QuestionGenerator: response has body", !!res.body);
			} catch (e) {
				console.debug("QuestionGenerator: failed to read response metadata", e);
			}
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

			// Extract model from response headers
			const modelUsed = res.headers.get("X-Model-Used");
			if (modelUsed) {
				setCurrentModel(modelUsed);
			}

			await processStream(res);
		} catch (error) {
			console.error("Failed to start conversation:", error);
			setErrorState({
				type: "generic",
				message: "Failed to start conversation.",
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
		setStreamingContent("");
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
		errorState?.type === "no_models_available";

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
					// propagate change and keep internal state in uncontrolled mode
					if (onOpenChange) onOpenChange(val);
					if (open === undefined) setIsOpen(val);
				}}
			>
				<DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
					<DialogHeader>
						<DialogTitle>AI Study Session</DialogTitle>
					</DialogHeader>

					{isBlockingError ? (
						<div className="space-y-4">
							<TokenWarning
								errorType={errorState?.type}
								customMessage={errorState?.message}
							/>
							<div className="flex justify-end gap-2">
								<Button
									variant="secondary"
									onClick={() => (window.location.href = "/pricing")}
								>
									Become Premium
								</Button>
								<Button
									onClick={() => {
										setErrorState(null);
										startConversation();
									}}
								>
									Retry
								</Button>
							</div>
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
								{streamingContent && (
									<div className="flex justify-start">
										<div className="bg-muted text-foreground px-4 py-3 rounded-lg max-w-[85%]">
											<Markdown content={streamingContent} />
										</div>
									</div>
								)}
								{loading && !streamingContent && (
									<div className="flex justify-start">
										<div className="bg-muted text-foreground px-4 py-3 rounded-lg">
											<p className="text-sm">Thinking...</p>
										</div>
									</div>
								)}

								{/* Show TokenWarning when not loading and there is no response (empty or interrupted) */}
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
										!streamingContent &&
										noAssistantResponse
									) {
										return (
											<TokenWarning
												errorType={errorState.type}
												variant="inline"
												customMessage={errorState.message}
												onRetryLater={() => {
													// Try restarting the conversation when the user retries
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
										className="cursor-pointer"
									>
										Close
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
									Don't trust the AI completely.
								</span>
							</div>
						</>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}
