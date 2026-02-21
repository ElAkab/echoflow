"use client";

import { useState, useEffect } from "react";
import { Coins, Crown, Sparkles, Check, Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function PaymentPage() {
	const [loadingCredits, setLoadingCredits] = useState(false);
	const [loadingPro, setLoadingPro] = useState(false);
	const [subscriptionStatus, setSubscriptionStatus] = useState<
		"inactive" | "active" | "cancelled" | "past_due" | null
	>(null);

	useEffect(() => {
		fetch("/api/subscriptions")
			.then((r) => r.json())
			.then((data) =>
				setSubscriptionStatus(data.subscription_status ?? "inactive"),
			)
			.catch(() => setSubscriptionStatus("inactive"));
	}, []);

	const handleTopUp = async () => {
		setLoadingCredits(true);
		try {
			const response = await fetch("/api/credits/checkout", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
			});
			const data = await response.json();

			if (data.devMode) {
				window.location.href = "/payment/success?dev_mode=true";
			} else if (data.url) {
				window.location.href = data.url;
			} else {
				console.error("Credits checkout error:", data);
			}
		} catch (error) {
			console.error("Top-up error:", error);
		} finally {
			setLoadingCredits(false);
		}
	};

	const handleSubscribe = async () => {
		setLoadingPro(true);
		try {
			const response = await fetch("/api/subscriptions", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
			});
			const data = await response.json();

			if (data.devMode) {
				setSubscriptionStatus("active");
			} else if (data.url) {
				window.location.href = data.url;
			} else {
				console.error("Subscription error:", data);
			}
		} catch (error) {
			console.error("Subscribe error:", error);
		} finally {
			setLoadingPro(false);
		}
	};

	const isProActive = subscriptionStatus === "active";

	return (
		<div className="max-w-4xl mx-auto space-y-8">
			{/* Header */}
			<div className="text-center space-y-3">
				<h1 className="text-3xl font-bold">Choose Your Access</h1>
				<p className="text-muted-foreground max-w-lg mx-auto">
					Access premium AI models for higher quality quizzes.
				</p>
			</div>

			{/* Two Options */}
			<div className="grid gap-6 md:grid-cols-2">
				{/* Pro Subscription */}
				<Card
					className={`relative flex flex-col ${isProActive ? "border-primary shadow-lg" : ""}`}
				>
					{isProActive && (
						<Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-green-600">
							Active
						</Badge>
					)}
					<CardHeader className="pb-4">
						<div className="flex items-center gap-2 mb-1">
							<Crown className="h-5 w-5 text-primary" />
							<CardTitle className="text-xl">Pro Plan</CardTitle>
						</div>
						<CardDescription>For regular users</CardDescription>
					</CardHeader>
					<CardContent className="flex-1 space-y-4">
						<div className="text-center">
							<div className="text-4xl font-bold">€7</div>
							<div className="text-sm text-muted-foreground">per month</div>
						</div>
						<ul className="space-y-2 text-sm">
							<li className="flex items-center gap-2">
								<Check className="h-4 w-4 text-green-500" />
								<span>
									<strong>Unlimited</strong> premium quizzes
								</span>
							</li>
							<li className="flex items-center gap-2">
								<Check className="h-4 w-4 text-green-500" />
								<span>GPT-4o &amp; Mistral 7B models</span>
							</li>
							<li className="flex items-center gap-2">
								<Check className="h-4 w-4 text-green-500" />
								<span>Priority support</span>
							</li>
							<li className="flex items-center gap-2">
								<Check className="h-4 w-4 text-green-500" />
								<span>Cancel anytime</span>
							</li>
						</ul>
					</CardContent>
					<CardFooter>
						{isProActive ? (
							<Button className="w-full" variant="outline" disabled>
								<Check className="mr-2 h-4 w-4" />
								Subscribed
							</Button>
						) : (
							<Button
								className="w-full cursor-pointer dark:hover:text-primary"
								variant="outline"
								onClick={handleSubscribe}
								disabled={loadingPro || subscriptionStatus === null}
							>
								{loadingPro ? (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								) : (
									<Crown className="mr-2 h-4 w-4" />
								)}
								Subscribe — €7/month
							</Button>
						)}
					</CardFooter>
				</Card>

				{/* Top-up Credits */}
				<Card className="relative flex flex-col border-primary shadow-lg">
					<Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary">
						Pay-as-you-go
					</Badge>
					<CardHeader className="pb-4">
						<div className="flex items-center gap-2 mb-1">
							<Coins className="h-5 w-5 text-primary" />
							<CardTitle className="text-xl">Credits</CardTitle>
						</div>
						<CardDescription>For occasional use</CardDescription>
					</CardHeader>
					<CardContent className="flex-1 space-y-4">
						<div className="text-center">
							<div className="text-4xl font-bold">€3</div>
							<div className="text-sm text-muted-foreground">
								one-time payment
							</div>
						</div>
						<ul className="space-y-2 text-sm">
							<li className="flex items-center gap-2">
								<Check className="h-4 w-4 text-green-500" />
								<span>
									<strong>30 premium</strong> credits
								</span>
							</li>
							<li className="flex items-center gap-2">
								<Check className="h-4 w-4 text-green-500" />
								<span>Never expire</span>
							</li>
							<li className="flex items-center gap-2">
								<Check className="h-4 w-4 text-green-500" />
								<span>Same premium models</span>
							</li>
							<li className="flex items-center gap-2">
								<Check className="h-4 w-4 text-green-500" />
								<span>No commitment</span>
							</li>
						</ul>
					</CardContent>
					<CardFooter>
						<Button
							className="w-full cursor-pointer"
							size="lg"
							onClick={handleTopUp}
							disabled={loadingCredits}
						>
							{loadingCredits ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : (
								<Coins className="mr-2 h-4 w-4" />
							)}
							Buy Credits
						</Button>
					</CardFooter>
				</Card>
			</div>

			{/* Free Tier Info */}
			<Alert className="bg-muted border-muted">
				<Sparkles className="h-4 w-4" />
				<AlertDescription>
					<strong>Free:</strong> 20 quizzes/day with standard models. No credit
					card required.
				</AlertDescription>
			</Alert>

			{/* FAQ */}
			<div className="grid gap-4 text-sm text-muted-foreground">
				<div className="flex items-start gap-2">
					<Zap className="h-4 w-4 mt-0.5 shrink-0" />
					<div>
						<strong className="text-foreground">
							What happens when I run out of credits?
						</strong>
						<p>
							You automatically switch to free models. You are never blocked.
						</p>
					</div>
				</div>
				<div className="flex items-start gap-2">
					<Coins className="h-4 w-4 mt-0.5 shrink-0" />
					<div>
						<strong className="text-foreground">Do credits expire?</strong>
						<p>
							No. Purchased credits never expire — use them at your own pace.
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
