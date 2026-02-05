"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, Clock, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export interface TokenWarningProps {
	errorType?:
		| "quota_exhausted"
		| "rate_limit"
		| "no_models_available"
		| "generic";
	customMessage?: string;
	premiumUrl?: string;
	onRetryLater?: () => void;
	variant?: "card" | "inline";
}

const ERROR_MESSAGES = {
	quota_exhausted: {
		title: "Free quota exhausted",
		description:
			"All free AI models have reached their limit. Please try again in a few minutes or upgrade to premium for unlimited access.",
		icon: AlertTriangle,
	},
	rate_limit: {
		title: "Rate limit reached",
		description:
			"You have made too many requests. Please wait a moment before trying again.",
		icon: Clock,
	},
	no_models_available: {
		title: "No models available",
		description:
			"No free AI models are currently available. Try again later or upgrade to premium for priority access.",
		icon: AlertTriangle,
	},
	generic: {
		title: "Service temporarily unavailable",
		description: "An error occurred. Please try again shortly.",
		icon: AlertTriangle,
	},
};

export function TokenWarning({
	errorType = "quota_exhausted",
	customMessage,
	premiumUrl = "/pricing",
	onRetryLater,
	variant = "card",
}: TokenWarningProps) {
	const router = useRouter();
	const errorConfig = ERROR_MESSAGES[errorType];
	const Icon = errorConfig.icon;

	const handleRetryLater = () => {
		if (onRetryLater) {
			onRetryLater();
		} else {
			window.location.reload();
		}
	};

	const handleUpgradeToPremium = () => {
		router.push(premiumUrl);
	};

	if (variant === "inline") {
		return (
			<div className="flex items-center gap-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
				<Icon className="h-5 w-5 text-yellow-500 flex-shrink-0" />
				<div className="flex-1">
					<p className="text-sm font-medium text-yellow-500">
						{errorConfig.title}
					</p>
					<p className="text-xs text-muted-foreground mt-1">
						{customMessage || errorConfig.description}
					</p>
				</div>
				<div className="flex gap-2">
					<Button variant="outline" size="sm" onClick={handleRetryLater}>
						<Clock className="h-4 w-4 mr-2 cursor-pointer" />
						Retry
					</Button>
					<Button
						size="sm"
						onClick={handleUpgradeToPremium}
						className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
					>
						<Crown className="h-4 w-4 mr-2 cursor-pointer" />
						Premium
					</Button>
				</div>
			</div>
		);
	}

	return (
		<Card className="w-full max-w-md mx-auto border-yellow-500/20 bg-yellow-500/5">
			<CardHeader className="text-center">
				<div className="mx-auto w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center mb-4">
					<Icon className="h-6 w-6 text-yellow-500" />
				</div>
				<CardTitle className="text-yellow-500">{errorConfig.title}</CardTitle>
				<CardDescription className="text-base">
					{customMessage || errorConfig.description}
				</CardDescription>
			</CardHeader>

			<CardContent className="space-y-4">
				<div className="bg-muted/50 p-4 rounded-lg text-sm text-muted-foreground">
					<p className="font-medium mb-2">💡 Tip:</p>
					<ul className="space-y-1 text-xs">
						<li>• Free quotas automatically refill over time</li>
						<li>• Premium plan offers unlimited and priority access</li>
						<li>• Your notes and categories are safely saved</li>
					</ul>
				</div>
			</CardContent>

			<CardFooter className="flex gap-3">
				<Button
					variant="outline"
					className="flex-1 cursor-pointer dark:hover:bg-gray-700/30 dark:hover:text-white"
					onClick={handleRetryLater}
				>
					<Clock className="h-4 w-4 mr-2" />
					Retry later
				</Button>
				<Button
					className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 dark:hover:from-purple-700 dark:hover:to-pink-700 transition cursor-pointer"
					onClick={handleUpgradeToPremium}
				>
					<Crown className="h-4 w-4 mr-2" />
					Become Premium
				</Button>
			</CardFooter>
		</Card>
	);
}
