import Link from "next/link";

export const metadata = {
	title: "Learn More — Brain Loop",
};

export default function LearnMorePage() {
	return (
		<main className="min-h-screen  pb-8 bg-gradient-to-b dark:from-gray-900 dark:to-gray-800">
            <header className="flex items-center px-8 sm:px-16 md:px-32 bg-gradient-to-b dark:from-gray-900/10 dark:to-gray-800/10 backdrop-blur-lg border-b border-gray-700/50 justify-between mb-8 sticky top-0 py-4">
					<h1 className="text-2xl font-bold text-primary cursor-pointer">
						Brain Loop
					</h1>
					<nav className="space-x-6">
						<Link
							href="/contact"
							className="text-sm text-gray-400 hover:text-primary transition-colors"
						>
							Contact
						</Link>
						<Link
							href="#features"
							className="text-sm text-gray-400 hover:text-primary transition-colors"
						>
							Features
						</Link>
					</nav>
            </header>
			<div className="max-w-4xl mx-auto px-8">
				

				<div className="text-center md:px-24">
					<h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-primary-900 bg-clip-text text-transparent">
						Learn More
					</h2>

					<p className="text-lg text-gray-400 mb-8">
						Learning shouldn’t stop at note-taking
					</p>
				</div>

				<section className="text-left w-full sm:w-auto text-gray-200 space-y-4 prose prose-invert max-w-none">
					<p>
						Taking notes is only the first step. Most people reread their notes
						passively, thinking they understand — until they realize they don’t
						remember much when it actually matters.
					</p>

					<p>
						Real learning happens when you actively recall information, not when
						you simply consume it.
					</p>

					<h2 className="text-2xl font-semibold mt-6">
						Built around Active Recall Learning
					</h2>

					<p>
						This project is built around active recall, a learning technique
						backed by cognitive science.
					</p>

					<p>
						Instead of rereading your notes, you are questioned on them. The
						goal is simple: turn your notes into a training ground, not an
						archive.
					</p>

					<p>
						Over time, additional proven learning techniques may be integrated
						to further improve retention and understanding.
					</p>

					<h3 className="text-xl font-semibold mt-6">How it works</h3>

					<ol className="list-decimal list-inside text-gray-300 space-y-2 ml-4">
						<li>You write your notes, naturally and freely.</li>
						<li>You select one or multiple notes.</li>
						<li>
							The AI generates targeted questions based only on your content.
						</li>
						<li>You answer, uncover gaps in your understanding, and reinforce what truly matters — with AI-generated guidance.</li>
						<li>You improve through active engagement, not passive reading.</li>
					</ol>

					<p className="mt-4">
						No generic quizzes. No external content. Only <b>your knowledge</b>,
						challenged intelligently.
					</p>

					<h3 className="text-xl font-semibold mt-6">Who is it for?</h3>

					<ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
						<li>Self-learners who want to learn efficiently and deeply.</li>
						<li>Students preparing for exams or complex subjects.</li>
						<li>Developers learning new technologies, concepts, or systems.</li>
						<li>Anyone who values understanding over memorization.</li>
					</ul>

					<h3 className="text-xl font-semibold mt-6">
						A learning tool, not a shortcut
					</h3>

					<p>
						This tool doesn’t aim to replace thinking. It exists to guide it.
						The AI is not there to give answers, but to ask the right questions.
					</p>

					{/* CTA */}
					<div className="flex justify-center pt-8">
						<Link
							href="/auth/login"
							className="
                                block
                                w-full sm:w-fit
                                mx-auto
                                px-6 py-3 sm:px-8 sm:py-4
                                bg-gradient-to-br from-primary to-primary-900
                                text-white font-semibold
                                rounded-lg
                                text-center
                                transition-all duration-300
                                hover:-translate-y-0.5
                                shadow-lg hover:shadow-xl
                            "
						>
							Get Started
						</Link>
					</div>
				</section>
			</div>
		</main>
	);
}
