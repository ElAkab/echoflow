"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Clock, Crown, KeyRound, Loader2 } from "lucide-react";
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
		| "platform_budget_exhausted"
		| "byok_or_upgrade_required"
		| "rate_limit"
		| "no_models_available"
		| "generic";
	customMessage?: string;
	premiumUrl?: string;
	byokUrl?: string;
	onRetryLater?: () => void;
	onOpenApiKeySettings?: () => void;
	variant?: "card" | "inline";
}

const ERROR_MESSAGES = {
	quota_exhausted: {
		title: "Free quota exhausted",
		description:
			"All free AI models have reached their limit. Please try again in a few minutes or upgrade to premium for unlimited access.",
		icon: AlertTriangle,
	},
	platform_budget_exhausted: {
		title: "Platform budget reached",
		description:
			"The shared AI budget is exhausted for today. Add your own OpenRouter key or upgrade to keep learning.",
		icon: AlertTriangle,
	},
	byok_or_upgrade_required: {
		title: "Continue with your API key",
		description:
			"To continue right now, add your personal OpenRouter API key in settings, or upgrade to premium.",
		icon: KeyRound,
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
	premiumUrl = "/payment",
	byokUrl = "/settings?section=ai-key",
	onRetryLater,
	onOpenApiKeySettings,
	variant = "card",
}: TokenWarningProps) {
	const router = useRouter();
	const [isRetrying, setIsRetrying] = useState(false);
	const [isNavigating, setIsNavigating] = useState<string | null>(null);
	
	const errorConfig = ERROR_MESSAGES[errorType];
	const Icon = errorConfig.icon;

	const handleRetryLater = async () => {
		setIsRetrying(true);
		try {
			if (onRetryLater) {
				await onRetryLater();
			} else {
				window.location.reload();
			}
		} finally {
			setIsRetrying(false);
		}
	};

	const handleUpgradeToPremium = async () => {
		setIsNavigating("premium");
		router.push(premiumUrl);
	};

	const handleOpenApiKeySettings = async () => {
		setIsNavigating("apikey");
		if (onOpenApiKeySettings) {
			onOpenApiKeySettings();
			return;
		}
		router.push(byokUrl);
	};

	if (variant === "inline") {
		return (
			<div className="flex flex-col gap-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
				{/* Header avec icône et titre */}
				<div className="flex items-start gap-3">
					<Icon className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
					<div className="flex-1 min-w-0">
						<p className="text-sm font-medium text-yellow-500">
							{errorConfig.title}
						</p>
						<p className="text-xs text-muted-foreground mt-1">
							{customMessage || errorConfig.description}
						</p>
					</div>
				</div>
				
				{/* Boutons en grille responsive */}
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={handleRetryLater}
						disabled={isRetrying}
						className="w-full"
					>
						{isRetrying ? (
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
						) : (
							<Clock className="h-4 w-4 mr-2" />
						)}
						Retry
					</Button>
					<Button
						size="sm"
						onClick={handleUpgradeToPremium}
						disabled={isNavigating === "premium"}
						className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
					>
						{isNavigating === "premium" ? (
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
						) : (
							<Crown className="h-4 w-4 mr-2" />
						)}
						Premium
					</Button>
					<Button
						size="sm"
						variant="secondary"
						onClick={handleOpenApiKeySettings}
						disabled={isNavigating === "apikey"}
						className="w-full"
					>
						{isNavigating === "apikey" ? (
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
						) : (
							<KeyRound className="h-4 w-4 mr-2" />
						)}
						API Key
					</Button>
				</div>
			</div>
		);
	}

	return (
		<Card className="w-full max-w-md mx-auto border-yellow-500/20 bg-yellow-500/5">
			<CardHeader className="text-center pb-2">
				<div className="mx-auto w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center mb-4">
					<Icon className="h-6 w-6 text-yellow-500" />
				</div>
				<CardTitle className="text-yellow-500">{errorConfig.title}</CardTitle>
				<CardDescription className="text-base mt-2">
					{customMessage || errorConfig.description}
				</CardDescription>
			</CardHeader>

			<CardContent className="space-y-4 pb-4">
				<div className="bg-muted/50 p-4 rounded-lg text-sm text-muted-foreground">
					<p className="font-medium mb-2">💡 Tip:</p>
					<ul className="space-y-1 text-xs">
						<li>• Free quotas automatically refill over time</li>
						<li>• Premium plan offers unlimited and priority access</li>
						<li>• You can bring your own OpenRouter API key anytime</li>
						<li>• Your notes and categories are safely saved</li>
					</ul>
				</div>
			</CardContent>

			<CardFooter className="flex flex-col sm:flex-row gap-3 pt-0">
				<Button
					variant="outline"
					className="w-full"
					onClick={handleRetryLater}
					disabled={isRetrying}
				>
					{isRetrying ? (
						<Loader2 className="h-4 w-4 mr-2 animate-spin" />
					) : (
						<Clock className="h-4 w-4 mr-2" />
					)}
					Retry
				</Button>
				<Button
					className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
					onClick={handleUpgradeToPremium}
					disabled={isNavigating === "premium"}
				>
					{isNavigating === "premium" ? (
						<Loader2 className="h-4 w-4 mr-2 animate-spin" />
					) : (
						<Crown className="h-4 w-4 mr-2" />
					)}
					Premium
				</Button>
				<Button
					variant="secondary"
					className="w-full"
					onClick={handleOpenApiKeySettings}
					disabled={isNavigating === "apikey"}
				>
					{isNavigating === "apikey" ? (
						<Loader2 className="h-4 w-4 mr-2 animate-spin" />
					) : (
						<KeyRound className="h-4 w-4 mr-2" />
					)}
					API Key
				</Button>
			</CardFooter>
		</Card>
	);
}
