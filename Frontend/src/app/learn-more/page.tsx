import Link from "next/link";
import { PublicHeader } from "@/components/layout/PublicHeader";

export const metadata = {
	title: "Learn More — Echoflow",
};

export default function LearnMorePage() {
	return (
		<main className="min-h-screen pb-12 bg-gradient-to-b dark:from-gray-900 dark:to-gray-800">
			<PublicHeader />
			<div className="max-w-4xl mx-auto px-8 mt-12">
				<div className="text-center md:px-24 mb-10">
					<h1 className="text-4xl md:text-6xl font-extrabold mb-6 bg-gradient-to-r dark:from-primary to-[#053f61] bg-clip-text text-transparent">
						Beyond Note-Taking
					</h1>
					<p className="text-xl text-gray-400 italic">
						"Learning is not a spectator sport."
					</p>
				</div>

				<section className="text-gray-200 space-y-8 prose prose-invert max-w-none">
					<div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 shadow-inner">
						<p className="text-lg leading-relaxed m-0">
							Most people (like me) reread their notes passively, creating an{" "}
							<a
								href="https://www.coursera.org/articles/illusion-of-competence"
								className="text-primary hover:underline ml-1"
								target="_blank"
							>
								illusion of competence
							</a>
							. Real mastery doesn't come from consuming information, it comes
							from the struggle to retrieve it.
						</p>
					</div>

					<div>
						<h2 className="text-3xl font-bold text-white flex items-center gap-2 mb-3">
							Built for Active Recall
						</h2>
						<p className="text-gray-300">
							This interface is engineered around <strong>Active Recall</strong>
							, a high-utility learning technique backed by
							<a
								href="https://en.wikipedia.org/wiki/Cognitive_science"
								className="text-primary hover:underline ml-1"
								target="_blank"
							>
								cognitive science
							</a>
							.
						</p>
						<p className="text-gray-300">
							By forcing your brain to "fetch" information instead of just
							seeing it, you stimulate the neural pathways between the
							prefrontal cortex and the hippocampus, ensuring long-term
							retention.
						</p>
					</div>

					<div>
						<h2 className="text-3xl font-bold text-white flex items-center gap-2 mb-3">
							Metacognition
						</h2>
						<p className="text-gray-300">
							Our AI-driven interrogation isn't just about questions : it's
							about{" "}
							<a
								href="https://en.wikipedia.org/wiki/Metacognition"
								className="text-primary hover:underline ml-1"
								target="_blank"
							>
								Metacognition
							</a>
							-thinking about how you think. By identifying your weak spots and
							receiving intelligent feedback, you gain a clear vision of what
							you truly know and what you only <i>think</i> you know.
						</p>
					</div>

					<div className="grid md:grid-cols-2 gap-8 py-4">
						<div className="bg-gray-800/30 p-6 rounded-lg border border-gray-700 h-full">
							<h3 className="text-xl font-semibold mb-4 border-b border-primary pb-2 w-fit">
								How it works
							</h3>
							<ol className="list-decimal list-inside text-gray-300 space-y-4">
								<li>
									<strong>Organize</strong>: Create a dedicated category for
									your subject to keep your workspace structured.
								</li>
								<li>
									<strong>Capture</strong>: Write your notes using{" "}
									<a
										href="https://en.wikipedia.org/wiki/Markdown"
										className="text-primary hover:underline ml-1"
										target="_blank"
									>
										Markdown
									</a>
									. Structured text is proven to improve visual hierarchy and
									cognitive processing{" "}
									<a
										href="https://oneuptime.com/blog/post/2026-01-19-why-markdown-is-the-best-format-for-notetaking/view"
										className="text-primary hover:underline ml-1"
										target="_blank"
									>
										trust me.
									</a>
								</li>
								<li>
									<strong>Review</strong>: Study your content in a clean,
									distraction-free environment designed for focus.
								</li>
								<li>
									<strong>Challenge</strong>: Activate the AI Quiz in{" "}
									<strong>one click</strong>. The AI instantly transforms your
									notes into a personalized training session.
								</li>
							</ol>
						</div>

						<div className="bg-gray-800/30 p-6 rounded-lg border border-gray-700">
							<h3 className="text-xl font-semibold mb-4 border-b border-primary pb-2 w-fit">
								Who is it for?
							</h3>
							<ul className="list-disc list-inside text-gray-300 space-y-3">
								<li>
									<strong>Self-learners</strong> aiming for deep mastery.
								</li>
								<li>
									<strong>Students</strong> tackling complex subjects.
								</li>
								<li>
									<strong>Developers</strong> learning new architectures.
								</li>
								<li>
									Anyone valuing <strong>logic over memorization</strong>.
								</li>
							</ul>
						</div>
					</div>

					<div className="border-l-4 border-primary pl-6 py-2 my-8">
						<h3 className="text-2xl font-bold text-white mb-2">
							A tool, not a shortcut
						</h3>
						<p className="text-gray-400 italic m-0">
							The AI isn't here to give you the answers; it's here to ask the
							right questions. No generic quizzes. No external noise. Just{" "}
							<strong>your knowledge</strong>, challenged intelligently.
						</p>
					</div>

					<div className="flex flex-col items-center justify-center pt-4 space-y-4">
						<Link
							href="/auth/login"
							className="inline-block px-8 py-4 bg-gradient-to-br from-primary to-primary-900 text-white font-semibold rounded-lg transition-all duration-300 hover:-translate-y-0.5 shadow-lg hover:shadow-xl"
						>
							Get Started
						</Link>
						<p className="text-sm text-gray-500 italic">
							Focus on understanding. We'll handle the challenge.
						</p>
					</div>
				</section>
			</div>
		</main>
	);
}
