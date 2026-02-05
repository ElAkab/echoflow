"use client";

import {
	signInWithGoogle,
	signInWithEmail,
	signInWithDemo,
} from "@/lib/auth/actions";
import { useState } from "react";

export default function LoginPage() {
	const [message, setMessage] = useState("");
	const [loading, setLoading] = useState(false);

	async function handleGoogleSignIn() {
		setLoading(true);
		await signInWithGoogle();
	}

	async function handleEmailSignIn(formData: FormData) {
		setLoading(true);
		const result = await signInWithEmail(formData);

		if (result.error) {
			setMessage(result.error);
		} else {
			setMessage(result.message || "Check your email!");
		}
		setLoading(false);
	}

	async function handleDemoSignIn(formData: FormData) {
		setLoading(true);
		const password = formData.get("demoPassword") as string;
		const result = await signInWithDemo(password);
		
		if (result?.error) {
			setMessage(result.error);
			setLoading(false);
		}
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 p-4">
			<div className="w-full max-w-md p-8 rounded-2xl shadow-xl">
				<div className="text-center mb-8">
					<h1 className="text-3xl font-bold mb-2">Welcome Back</h1>
					<p className="text-gray-600">Sign in to continue learning</p>
				</div>

				{message && (
					<div
						className={`mb-4 p-4 rounded-lg ${
							message.includes("error") || message.includes("Error")
								? "bg-red-50 text-red-600"
								: "bg-green-50 text-green-600"
						}`}
					>
						{message}
					</div>
				)}

				<div className="space-y-4">
					<form action={handleGoogleSignIn}>
						<button
							type="submit"
							disabled={loading}
							aria-label="Continue with Google"
							className="w-full py-3 px-4 border-2 border-gray-700 rounded-lg hover:border-gray-600 transition cursor-pointer flex items-center justify-center gap-3 font-medium disabled:opacity-50"
						>
							<span className="inline-flex items-center mr-2">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 533.5 544.3"
									className="h-5 w-5"
									aria-hidden="true"
								>
									<path
										fill="#4285F4"
										d="M533.5 278.4c0-17.6-1.5-35.2-4.6-52.1H272v98.6h146.9c-6.3 34.1-25.1 63-53.7 82.4v68.4h86.8c50.8-46.8 81.5-115.9 81.5-197.3z"
									/>
									<path
										fill="#34A853"
										d="M272 544.3c72.6 0 133.6-24.1 178.1-65.4l-86.8-68.4c-24.3 16.3-55.1 25.9-91.3 25.9-70 0-129.4-47.2-150.6-110.6H33.8v69.5C77.7 475 167.6 544.3 272 544.3z"
									/>
									<path
										fill="#FBBC05"
										d="M121.4 330.8c-7.6-22.8-7.6-47.4 0-70.2V191.1H33.8c-42.8 85.7-42.8 187.1 0 272.8l87.6-69.5z"
									/>
									<path
										fill="#EA4335"
										d="M272 109.6c39.6 0 75.2 13.6 103.2 40.4l77.4-77.4C405.9 24.2 347.2 0 272 0 167.6 0 77.7 69.3 33.8 172.3l87.6 69.5C142.6 157.0 202 109.6 272 109.6z"
									/>
								</svg>
							</span>
							<span>Continue with Google</span>
						</button>
					</form>

					<div className="relative my-6">
						<div className="absolute inset-0 flex items-center">
							<div className="w-full border-t border-gray-300"></div>
						</div>
						<div className="relative flex justify-center text-sm">
							<span className="px-4 dark:bg-[#172130] text-gray-400">
								Or with email
							</span>
						</div>
					</div>

					<form action={handleEmailSignIn} className="space-y-4">
						<input
							type="email"
							name="email"
							required
							placeholder="your@email.com"
							className="w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
						/>

						<button
							type="submit"
							disabled={loading}
							className="w-full py-3 px-4 bg-linear-to-br from-primary to-primary-900 hover:-translate-y-0.5 cursor-pointer text-white font-semibold rounded-lg transition shadow-lg hover:shadow-xl disabled:opacity-50"
						>
							{loading ? "Sending..." : "Send Magic Link"}
						</button>
					</form>

					{/* Demo Account */}
					<form action={handleDemoSignIn} className="space-y-3">
						<div className="relative flex justify-center text-xs">
							<span className="px-4 dark:bg-[#172130] text-gray-400">
								For testers only
							</span>
						</div>
						<input
							type="password"
							name="demoPassword"
							required
							placeholder="Demo access code"
							className="w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none transition"
						/>
						<button
							type="submit"
							disabled={loading}
							className="w-full py-3 px-4 border-2 border-primary/50 bg-primary/5 rounded-lg hover:bg-primary/10 transition cursor-pointer flex items-center justify-center gap-2 font-medium disabled:opacity-50"
						>
							<span>🎮</span>
							<span>Try Demo Account</span>
						</button>
					</form>
				</div>

				<p className="text-center text-sm text-gray-500 mt-8">
					New to Brain Loop?{" "}
					<span className="text-primary font-medium">
						Just sign in - we'll create your account automatically!
					</span>
				</p>
			</div>
		</div>
	);
}
