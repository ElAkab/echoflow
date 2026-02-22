import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
	return (
		<main className="flex min-h-screen flex-col items-center justify-center p-8 md:p-24 bg-gradient-to-b dark:from-gray-900 dark:to-gray-800">
			<div className="text-center max-w-4xl">
				<div className="flex items-center justify-center gap-4 mb-8">
					<div className="flex items-start gap-2">
						<span className="text-5xl md:text-6xl font-bold bg-gradient-to-tr dark:from-primary to-[#053f61] bg-clip-text text-transparent">
							Echoflow
						</span>
						<Badge className="mt-1.5 px-2 py-0.5 text-[10px] tracking-widest font-semibold bg-primary/10 text-primary border border-primary/30 dark:bg-primary/20 dark:border-primary/40 hover:bg-primary/10">
							BETA
						</Badge>
					</div>
					<img
						src="/images/echoflow_logo.png"
						alt="Echoflow Logo"
						className="h-28 w-28"
					/>
				</div>

				<p className="text-xl md:text-2xl text-gray-400 mb-4">
					AI-Powered Learning Through Active Recall
				</p>

				<p className="text-gray-400 mb-12 max-w-2xl mx-auto">
					Transform your notes into interactive quizzes. Master any subject with
					the power of AI.
				</p>

				<div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
					<Link
						href="/auth/login"
						className="px-8 py-4 bg-gradient-to-br from-primary to-[#053f61] text-white font-semibold rounded-lg hover:-translate-y-0.5 transition-all shadow-lg hover:shadow-xl transform"
					>
						Get Started
					</Link>

					<Link
						href="/learn-more"
						className="px-8 py-4 text-primary font-semibold rounded-lg border-2 border-primary hover:bg-primary/20 hover:text-white transition-all"
					>
						Learn More
					</Link>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
					<div className="p-6 rounded-xl shadow-md hover:shadow-lg transition">
						<div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4 mx-auto">
							<span className="text-2xl">📝</span>
						</div>
						<h3 className="font-bold mb-2 text-lg">Take Notes</h3>
						<p className="text-sm text-gray-400">
							Organize your knowledge by categories
						</p>
					</div>

					<div className="p-6 rounded-xl shadow-md hover:shadow-lg transition">
						<div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4 mx-auto">
							<span className="text-2xl">🤖</span>
						</div>
						<h3 className="font-bold mb-2 text-lg">AI Quizzes</h3>
						<p className="text-sm text-gray-400">
							Get personalized questions with a single click
						</p>
					</div>

					<div className="p-6 rounded-xl shadow-md hover:shadow-lg transition">
						<div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4 mx-auto">
							<span className="text-2xl">🧠</span>
						</div>
						<h3 className="font-bold mb-2 text-lg">Master It</h3>
						<p className="text-sm text-gray-400">
							Active recall for better retention
						</p>
					</div>
				</div>
			</div>
		</main>
	);
}
