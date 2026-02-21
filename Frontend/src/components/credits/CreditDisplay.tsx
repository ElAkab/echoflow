"use client";

import { useEffect } from "react";
import { Coins, Plus, Gift, Crown, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useCreditsStore, type CreditInfo } from "@/lib/store/credits-store";

interface CreditDisplayProps {
	variant?: "compact" | "full";
}

export function CreditDisplay({ variant = "compact" }: CreditDisplayProps) {
	const { info, isLoading, fetchCredits, refreshCredits } = useCreditsStore();

	// Initial load
	useEffect(() => {
		fetchCredits();
	}, [fetchCredits]);

	// Refresh when the user returns to the tab after a quiz session
	useEffect(() => {
		const handleVisibility = () => {
			if (!document.hidden) refreshCredits();
		};
		document.addEventListener("visibilitychange", handleVisibility);
		return () =>
			document.removeEventListener("visibilitychange", handleVisibility);
	}, [refreshCredits]);

	if (isLoading) {
		return (
			<Button variant="ghost" size="sm" disabled className="gap-2">
				<Coins className="h-4 w-4" />
				<span>...</span>
			</Button>
		);
	}

	if (!info) return null;

	if (variant === "compact") {
		return (
			<Popover>
				<PopoverTrigger asChild>
					<CompactTrigger info={info} />
				</PopoverTrigger>
				<PopoverContent className="w-72" align="end">
					<CreditPopoverContent info={info} />
				</PopoverContent>
			</Popover>
		);
	}

	return (
		<div className="p-4 rounded-lg border bg-card">
			<CreditPopoverContent info={info} />
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────

function CompactTrigger({ info }: { info: CreditInfo }) {
	const isEmpty = !info.has_byok && !info.is_subscribed && info.total_available === 0;
	const isLow = !info.has_byok && !info.is_subscribed && info.credits > 0 && info.credits <= 5;
	const isFreeOnly = !info.has_byok && !info.is_subscribed && info.credits === 0 && info.free_remaining > 0;

	// Pro subscribers: show crown + "Pro" label
	if (info.is_subscribed) {
		return (
			<Button variant="ghost" size="sm" className="gap-2">
				<Crown className="h-4 w-4 text-primary" />
				<span className="font-medium text-primary">Pro</span>
			</Button>
		);
	}

	// BYOK users: show key icon + "Own key" label
	if (info.has_byok) {
		return (
			<Button variant="ghost" size="sm" className="gap-2">
				<Key className="h-4 w-4" />
				<span className="font-medium">Own key</span>
			</Button>
		);
	}

	const displayValue = info.credits > 0 ? info.credits : info.free_remaining;

	return (
		<Button
			variant="ghost"
			size="sm"
			className={`gap-2 ${isLow ? "text-yellow-500" : ""} ${isEmpty ? "text-destructive" : ""}`}
		>
			{isFreeOnly ? (
				<Gift className="h-4 w-4 text-green-500" />
			) : (
				<Coins
					className={`h-4 w-4 ${isEmpty ? "text-destructive" : isLow ? "text-yellow-500" : ""}`}
				/>
			)}
			<span className="font-medium">{displayValue}</span>
			{isFreeOnly && (
				<span className="text-xs text-muted-foreground">/day</span>
			)}
		</Button>
	);
}

function CreditPopoverContent({ info }: { info: CreditInfo }) {
	const isEmpty = !info.has_byok && !info.is_subscribed && info.total_available === 0;
	const isLow = !info.has_byok && !info.is_subscribed && info.credits > 0 && info.credits <= 5;
	const isFreeOnly = !info.has_byok && !info.is_subscribed && info.credits === 0 && info.free_remaining > 0;

	return (
		<div className="space-y-4">
			{/* Header */}
			<div className="flex items-center gap-3">
				<div
					className={`p-2 rounded-full ${
						info.is_subscribed
							? "bg-primary/10"
							: info.has_byok
								? "bg-muted"
								: isEmpty
									? "bg-destructive/10"
									: isFreeOnly
										? "bg-green-500/10"
										: isLow
											? "bg-yellow-500/10"
											: "bg-primary/10"
					}`}
				>
					{info.is_subscribed ? (
						<Crown className="h-5 w-5 text-primary" />
					) : info.has_byok ? (
						<Key className="h-5 w-5 text-muted-foreground" />
					) : isFreeOnly ? (
						<Gift className="h-5 w-5 text-green-500" />
					) : (
						<Coins
							className={`h-5 w-5 ${isEmpty ? "text-destructive" : isLow ? "text-yellow-500" : "text-primary"}`}
						/>
					)}
				</div>
				<div className="flex-1">
					<p className="text-sm font-medium">
						{info.is_subscribed
							? "Pro Plan"
							: info.has_byok
								? "Own OpenRouter key"
								: "Available credits"}
					</p>
					{info.is_subscribed ? (
						<p className="text-sm text-primary font-semibold">Active</p>
					) : info.has_byok ? (
						<p className="text-sm text-muted-foreground">No platform credits used</p>
					) : (
						<p className="text-2xl font-bold">
							{info.credits > 0 ? info.credits : info.free_remaining}
							{isFreeOnly && (
								<span className="text-sm font-normal text-muted-foreground ml-1">
									free today
								</span>
							)}
						</p>
					)}
				</div>
			</div>

			{/* Details for credit-based users */}
			{!info.has_byok && !info.is_subscribed && (
				<>
					<Separator />
					<div className="space-y-2 text-sm">
						{info.credits > 0 && (
							<div className="flex justify-between">
								<span className="text-muted-foreground">Purchased credits</span>
								<span className="font-medium">{info.credits}</span>
							</div>
						)}
						<div className="flex justify-between">
							<span className="text-muted-foreground">Free today</span>
							<span className="font-medium">
								{info.free_remaining} / {info.free_quota}
							</span>
						</div>
					</div>

					{isEmpty && (
						<p className="text-sm text-destructive">
							No credits left today. Buy credits or wait until tomorrow for your
							daily quota.
						</p>
					)}
					{isFreeOnly && (
						<p className="text-sm text-green-600">
							{info.free_remaining} free questions remaining today.
						</p>
					)}
					{isLow && (
						<p className="text-sm text-yellow-500">
							Only {info.credits} premium credits left.
						</p>
					)}
				</>
			)}

			{/* Pro Plan details */}
			{info.is_subscribed && (
				<>
					<Separator />
					<div className="space-y-1 text-sm">
						<div className="flex justify-between">
							<span className="text-muted-foreground">Premium quizzes</span>
							<span className="font-medium">No daily limit</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">Models</span>
							<span className="font-medium">GPT-4o · Mistral 7B</span>
						</div>
					</div>
				</>
			)}

			{/* BYOK details */}
			{info.has_byok && (
				<>
					<Separator />
					<p className="text-sm text-muted-foreground">
						Your OpenRouter key is used directly — platform credits are not
						consumed.
					</p>
				</>
			)}

			{!info.is_subscribed && (
				<Button className="w-full gap-2 cursor-pointer" asChild>
					<a href="/payment">
						<Plus className="h-4 w-4" />
						{info.has_byok ? "View plans" : "Buy Credits"}
					</a>
				</Button>
			)}
		</div>
	);
}
