"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { CheckCircle2, Crown, Loader2 } from "lucide-react";
import { useCreditsStore } from "@/lib/store/credits-store";

interface Props {
	isSubscription: boolean;
	sessionId: string | null;
}

export function PaymentSuccessContent({ isSubscription, sessionId }: Props) {
	const refreshCredits = useCreditsStore((state) => state.refreshCredits);
	const [syncing, setSyncing] = useState(isSubscription && !!sessionId);
	const [syncError, setSyncError] = useState(false);

	useEffect(() => {
		if (isSubscription && sessionId) {
			// Subscription: verify the Stripe session and activate in DB
			// (fallback in case the webhook fires with a delay)
			fetch("/api/subscriptions/sync", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ session_id: sessionId }),
			})
				.then((r) => r.json())
				.then((data) => {
					if (!data.activated && !data.alreadyActive && !data.devMode) {
						setSyncError(true);
					}
				})
				.catch(() => setSyncError(true))
				.finally(() => {
					setSyncing(false);
					refreshCredits();
				});
		} else {
			// Top-up: just refresh the credit balance
			refreshCredits();
		}
	}, [isSubscription, sessionId, refreshCredits]);

	if (syncing) {
		return (
			<div className="container mx-auto flex items-center justify-center min-h-[60vh] px-4">
				<Card className="w-full max-w-md text-center">
					<CardHeader className="flex flex-col items-center gap-4 pb-2">
						<div className="rounded-full bg-primary/10 p-3">
							<Loader2 className="h-10 w-10 text-primary animate-spin" />
						</div>
						<CardTitle className="text-2xl">Activating your Pro Plan…</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-muted-foreground">
							Confirming your subscription with Stripe, just a moment.
						</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (isSubscription) {
		return (
			<div className="container mx-auto flex items-center justify-center min-h-[60vh] px-4">
				<Card className="w-full max-w-md text-center">
					<CardHeader className="flex flex-col items-center gap-4 pb-2">
						<div className="rounded-full bg-green-100 p-3 dark:bg-green-900/30">
							<Crown className="h-10 w-10 text-green-600 dark:text-green-400" />
						</div>
						<CardTitle className="text-2xl">
							{syncError ? "Payment received!" : "Pro Plan activated!"}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-muted-foreground">
							{syncError
								? "Your payment was successful. Your Pro access will be activated shortly — check back in a moment."
								: "Welcome to Pro! You now have unlimited premium quiz generation. Enjoy!"}
						</p>
					</CardContent>
					<CardFooter className="flex justify-center pt-2">
						<Button asChild size="lg">
							<Link href="/dashboard">Go to Dashboard</Link>
						</Button>
					</CardFooter>
				</Card>
			</div>
		);
	}

	return (
		<div className="container mx-auto flex items-center justify-center min-h-[60vh] px-4">
			<Card className="w-full max-w-md text-center">
				<CardHeader className="flex flex-col items-center gap-4 pb-2">
					<div className="rounded-full bg-green-100 p-3 dark:bg-green-900/30">
						<CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
					</div>
					<CardTitle className="text-2xl">Credits Added!</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground">
						Your credits have been added to your account. You can now generate
						more AI quizzes!
					</p>
				</CardContent>
				<CardFooter className="flex justify-center pt-2">
					<Button asChild size="lg">
						<Link href="/dashboard">Go to Dashboard</Link>
					</Button>
				</CardFooter>
			</Card>
		</div>
	);
}
