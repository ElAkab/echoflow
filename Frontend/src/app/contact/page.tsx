import Link from "next/link";
import { PublicHeader } from "@/components/layout/PublicHeader";

export const metadata = {
	title: "Contact — Echoflow",
};

export default function ContactPage() {
	return (
		<main className="min-h-screen pb-8 bg-gradient-to-b dark:from-gray-900 dark:to-gray-800">
			<PublicHeader />

			<div className="max-w-4xl mx-auto px-8 mt-8">
				<div className="text-center md:px-24">
					<h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r dark:from-primary to-[#053f61] bg-clip-text text-transparent">
						Contact
					</h2>

					<p className="text-lg text-gray-400 mb-8">
						Have a question or feedback ? Send me a message.
					</p>
					<span className="text-sm text-gray-500 mb-12 block">
						(This form is for demonstration purposes only)
					</span>
				</div>

				<section className="w-full sm:w-auto text-gray-200 space-y-6 prose prose-invert max-w-none">
					<form
						action="mailto:hello@example.com"
						method="post"
						encType="text/plain"
						className="grid grid-cols-1 gap-4"
					>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<input
								type="text"
								name="name"
								placeholder="Your name"
								className="w-full px-4 py-3 rounded-lg bg-muted text-foreground border border-gray-700"
							/>
							<input
								type="email"
								name="email"
								placeholder="Your email"
								className="w-full px-4 py-3 rounded-lg bg-muted text-foreground border border-gray-700"
							/>
						</div>

						<textarea
							name="message"
							placeholder="Your message"
							rows={6}
							className="w-full px-4 py-3 rounded-lg bg-muted text-foreground border border-gray-700 resize-none"
							maxLength={300}
						/>
						<div className="flex justify-center">
							<button
								type="submit"
								className="block w-full sm:w-fit mx-auto px-6 py-3 sm:px-8 sm:py-4 bg-gradient-to-br from-primary to-primary-900 text-white font-semibold rounded-lg text-center transition-all duration-300 hover:-translate-y-0.5 shadow-lg hover:shadow-xl"
							>
								Send Message
							</button>
						</div>
					</form>
				</section>
			</div>
		</main>
	);
}
