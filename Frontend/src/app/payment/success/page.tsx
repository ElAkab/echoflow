"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { useCreditsStore } from "@/lib/store/credits-store";

export default function PaymentSuccessPage() {
	const refreshCredits = useCreditsStore((state) => state.refreshCredits);

	// Refresh credit balance so the header reflects the newly added credits
	// without requiring a full page reload.
	useEffect(() => {
		refreshCredits();
	}, [refreshCredits]);

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
