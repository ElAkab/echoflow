"use client";

import { useState } from "react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { CheckCircle2, Loader2 } from "lucide-react";

export default function ContactPage() {
	const [status, setStatus] = useState<
		"idle" | "loading" | "success" | "error"
	>("idle");
	const [errorMessage, setErrorMessage] = useState("");

	async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
		e.preventDefault();
		setStatus("loading");
		setErrorMessage("");

		const form = e.currentTarget;
		const data = {
			name: (form.elements.namedItem("name") as HTMLInputElement).value,
			email: (form.elements.namedItem("email") as HTMLInputElement).value,
			message: (form.elements.namedItem("message") as HTMLTextAreaElement)
				.value,
		};

		try {
			const res = await fetch("/api/contact", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			});

			const json = await res.json();

			if (!res.ok) {
				setErrorMessage(
					json.error ?? "Something went wrong. Please try again.",
				);
				setStatus("error");
				return;
			}

			setStatus("success");
			form.reset();
		} catch {
			setErrorMessage(
				"Network error. Please check your connection and try again.",
			);
			setStatus("error");
		}
	}

	return (
		<main className="min-h-screen pb-8 bg-gradient-to-b dark:from-gray-900 dark:to-gray-800">
			<PublicHeader />

			<div className="max-w-2xl mx-auto px-8 mt-12">
				<div className="text-center mb-10">
					<h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r dark:from-primary to-[#053f61] bg-clip-text text-transparent">
						Contact
					</h2>
					<p className="text-lg text-gray-400">
						Have a question or feedback? Send us a message.
					</p>
				</div>

				{status === "success" ? (
					<div className="flex flex-col items-center gap-4 py-16 text-center">
						<CheckCircle2 className="h-16 w-16 text-green-500" />
						<h3 className="text-2xl font-semibold text-gray-100">
							Message sent!
						</h3>
						<p className="text-gray-400 max-w-sm">
							Thank you for reaching out. We've sent you a confirmation email
							and will get back to you as soon as possible.
						</p>
						<button
							onClick={() => setStatus("idle")}
							className="mt-4 text-sm text-primary underline underline-offset-4 hover:opacity-80 transition-opacity"
						>
							Send another message
						</button>
					</div>
				) : (
					<form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5">
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div className="flex flex-col gap-1.5">
								<label htmlFor="name" className="text-sm text-gray-400">
									Name <span className="text-red-400">*</span>
								</label>
								<input
									id="name"
									type="text"
									name="name"
									required
									autoComplete="name"
									placeholder="Your name"
									className="w-full px-4 py-3 rounded-lg bg-muted text-foreground border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
								/>
							</div>
							<div className="flex flex-col gap-1.5">
								<label htmlFor="email" className="text-sm text-gray-400">
									Email <span className="text-red-400">*</span>
								</label>
								<input
									id="email"
									type="email"
									name="email"
									required
									autoComplete="email"
									placeholder="your@email.com"
									className="w-full px-4 py-3 rounded-lg bg-muted text-foreground border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
								/>
							</div>
						</div>

						<div className="flex flex-col gap-1.5">
							<label htmlFor="message" className="text-sm text-gray-400">
								Message <span className="text-red-400">*</span>
							</label>
							<textarea
								id="message"
								name="message"
								required
								autoComplete="off"
								placeholder="Your message..."
								rows={6}
								maxLength={1000}
								className="w-full px-4 py-3 rounded-lg bg-muted text-foreground border border-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
							/>
						</div>

						{status === "error" && (
							<p className="text-sm text-red-400 text-center">{errorMessage}</p>
						)}

						<div className="flex justify-center pt-2">
							<button
								type="submit"
								disabled={status === "loading"}
								className="flex items-center gap-2 w-full sm:w-fit mx-auto px-8 py-4 bg-gradient-to-br from-primary to-primary-900 text-white font-semibold rounded-lg text-center transition-all duration-300 hover:-translate-y-0.5 shadow-lg hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
							>
								{status === "loading" && (
									<Loader2 className="h-4 w-4 animate-spin" />
								)}
								{status === "loading" ? "Sending…" : "Send Message"}
							</button>
						</div>
					</form>
				)}
			</div>
		</main>
	);
}
