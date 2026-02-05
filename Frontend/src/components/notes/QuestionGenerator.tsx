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
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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

					await fetch("/api/study-sessions", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							noteIds: noteIdsToSave,
							categoryId,
							sessionType: noteIds && noteIds.length > 1 ? "MULTI_NOTE" : "SINGLE_NOTE",
							modelUsed: currentModel,
							conversationHistory: messages,
							questionsAsked: messages.filter((m) => m.role === "assistant").length,
						}),
					});
				} catch (error) {
					console.error("Failed to save study session:", error);
				}
			}
		};

		handleSaveSession();
	}, [isOpen, messages, noteId, noteIds, categoryId, currentModel]);

	const setOpen = (val: boolean) => {
		if (onOpenChange) onOpenChange(val);
		if (open === undefined) setIsOpen(val);
	};

	const processStream = async (
		response: Response,
		updatedMessages?: Message[],
	) => {
		const reader = response.body?.getReader();
		const decoder = new TextDecoder();

		if (!reader) {
			throw new Error("No reader available");
		}

		let accumulatedContent = "";

		try {
			console.debug("QuestionGenerator: processStream started");
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				console.debug("QuestionGenerator: received chunk", value && value.byteLength);
				const chunk = decoder.decode(value);
				const lines = chunk.split("\n");

				for (const line of lines) {
					if (line.startsWith("data: ")) {
						const data = line.slice(6);

						if (data === "[DONE]") {
							const assistantMessage: Message = {
								role: "assistant",
								content: accumulatedContent,
							};
							setMessages((prev) => [
								...(updatedMessages || prev),
								assistantMessage,
							]);
							setStreamingContent("");
							return;
						}

						try {
							const parsed = JSON.parse(data);
							const content = parsed.choices?.[0]?.delta?.content;

							if (content) {
								accumulatedContent += content;
								setStreamingContent(accumulatedContent);
							}
						} catch (e) {
							// ignore incomplete JSON
						}
					}
				}
			}
		} catch (error) {
			console.error("Stream processing error:", error);
			throw error;
		} finally {
			reader.releaseLock();
		}
	};

	const startConversation = async () => {
		console.debug("QuestionGenerator: startConversation called", { noteId, noteIds });
		setOpen(true);
		setMessages([]);
		setLoading(true);
		setStreamingContent("");

		try {
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
				alert(`Error: ${errorBody?.error || res.statusText}`);
				return;
			}

			await processStream(res);
		} catch (error) {
			console.error("Failed to start conversation:", error);
			alert("Failed to start conversation");
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
				alert(`Error: ${errorBody?.error || res.statusText}`);
				return;
			}

			await processStream(res, updatedMessages);
		} catch (error) {
			console.error("Failed to send message:", error);
			alert("Failed to send message");
		} finally {
			setLoading(false);
		}
	};

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
										<p className="text-sm whitespace-pre-wrap">{msg.content}</p>
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
							<Button variant="outline" onClick={() => setOpen(false)}>
								Close
							</Button>
							<Button onClick={sendMessage} disabled={loading || !input.trim()}>
								Send
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
