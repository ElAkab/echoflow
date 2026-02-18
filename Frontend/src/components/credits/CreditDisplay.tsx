"use client";

import { useState, useEffect } from "react";
import { Coins, Plus, Infinity, Gift, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

interface CreditInfo {
	premium_balance: number;
	monthly_credits_used: number;
	monthly_credits_limit: number;
	monthly_remaining: number;
	total_premium_available: number;
	free_quota: number;
	free_used: number;
	free_remaining: number;
	subscription_tier: string;
	subscription_status: string;
	is_pro: boolean;
	has_byok: boolean;
	total_available: number;
}

interface CreditDisplayProps {
	variant?: "compact" | "full";
}

export function CreditDisplay({ variant = "compact" }: CreditDisplayProps) {
	const [info, setInfo] = useState<CreditInfo | null>(null);
	const [loading, setLoading] = useState(true);
	
	useEffect(() => {
		fetchCreditInfo();
	}, []);
	
	const fetchCreditInfo = async () => {
		try {
			const res = await fetch("/api/credits");
			if (res.ok) {
				const data = await res.json();
				setInfo(data);
			}
		} catch (error) {
			console.error("Error fetching credits:", error);
		} finally {
			setLoading(false);
		}
	};
	
	if (loading) {
		return (
			<Button variant="ghost" size="sm" disabled className="gap-2">
				<Coins className="h-4 w-4" />
				<span>...</span>
			</Button>
		);
	}
	
	if (!info) return null;
	
	// Main display
	const displayValue = info.has_byok 
		? "∞" 
		: info.total_premium_available > 0 
			? info.total_premium_available 
			: info.free_remaining;
	
	const isFreeQuota = !info.has_byok && info.total_premium_available === 0 && info.free_remaining > 0;
	const isEmpty = !info.has_byok && info.total_premium_available === 0 && info.free_remaining === 0;
	const isLow = !info.has_byok && info.total_premium_available > 0 && info.total_premium_available <= 5;
	
	if (variant === "compact") {
		return (
			<Popover>
				<PopoverTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						className={`gap-2 ${isLow ? "text-yellow-500" : ""} ${isEmpty ? "text-destructive" : ""}`}
					>
						{info.has_byok ? (
							<Infinity className="h-4 w-4" />
						) : info.is_pro ? (
							<Crown className="h-4 w-4 text-amber-500" />
						) : isFreeQuota ? (
							<Gift className="h-4 w-4 text-green-500" />
						) : (
							<Coins className="h-4 w-4" />
						)}
						<span className="font-medium">{displayValue}</span>
						{info.is_pro && (
							<Badge variant="outline" className="text-xs ml-1 px-1">PRO</Badge>
						)}
						{isFreeQuota && (
							<span className="text-xs text-muted-foreground">/day</span>
						)}
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-80" align="end">
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

function CreditPopoverContent({ info }: { info: CreditInfo }) {
	const displayValue = info.has_byok 
		? "∞" 
		: info.total_premium_available > 0 
			? info.total_premium_available 
			: info.free_remaining;
	
	const isFreeQuota = !info.has_byok && info.total_premium_available === 0 && info.free_remaining > 0;
	const isEmpty = !info.has_byok && info.total_premium_available === 0 && info.free_remaining === 0;
	const isLow = !info.has_byok && info.total_premium_available > 0 && info.total_premium_available <= 5;
	
	return (
		<div className="space-y-4">
			{/* Header with main balance */}
			<div className="flex items-center gap-3">
				<div className={`p-2 rounded-full ${
					info.has_byok ? "bg-primary/10" :
					info.is_pro ? "bg-amber-500/10" :
					isEmpty ? "bg-destructive/10" : 
					isFreeQuota ? "bg-green-500/10" :
					isLow ? "bg-yellow-500/10" : "bg-primary/10"
				}`}>
					{info.has_byok ? (
						<Infinity className="h-5 w-5 text-primary" />
					) : info.is_pro ? (
						<Crown className="h-5 w-5 text-amber-500" />
					) : isFreeQuota ? (
						<Gift className="h-5 w-5 text-green-500" />
					) : (
						<Coins className={`h-5 w-5 ${
							isEmpty ? "text-destructive" : 
							isLow ? "text-yellow-500" : "text-primary"
						}`} />
					)}
				</div>
				<div className="flex-1">
					<p className="text-sm font-medium">
						{info.has_byok ? "Unlimited Questions" : 
						 info.is_pro ? "Pro Plan Active" : 
						 "Study Questions"}
					</p>
					<p className="text-2xl font-bold">
						{displayValue}
						{isFreeQuota && (
							<span className="text-sm font-normal text-muted-foreground ml-1">
								free today
							</span>
						)}
					</p>
				</div>
			</div>
			
			{/* Details */}
			{!info.has_byok && (
				<>
					<Separator />
					
					<div className="space-y-2 text-sm">
						{/* Premium credits */}
						{(info.is_pro || info.premium_balance > 0) && (
							<div className="flex justify-between">
								<span className="text-muted-foreground">
									{info.is_pro ? "Monthly Credits" : "Purchased Credits"}
								</span>
								<span className="font-medium">
									{info.is_pro 
										? `${info.monthly_remaining} / ${info.monthly_credits_limit}`
										: info.premium_balance
									}
								</span>
							</div>
						)}
						
						{/* Free quota */}
						<div className="flex justify-between">
							<span className="text-muted-foreground">Free Today</span>
							<span className="font-medium">
								{info.free_remaining} / {info.free_quota}
							</span>
						</div>
					</div>
					
					{/* Alert messages */}
					{isEmpty && (
						<p className="text-sm text-destructive">
							You have used all your free questions!
							Buy credits or upgrade to Pro.
						</p>
					)}
					
					{isFreeQuota && (
						<p className="text-sm text-green-600">
							🎁 {info.free_remaining} free questions remaining today.
							At midnight, you will get {info.free_quota} more.
						</p>
					)}
					
					{isLow && (
						<p className="text-sm text-yellow-500">
							⚠️ Only {info.total_premium_available} premium credits left! Consider topping up.
						</p>
					)}
				</>
			)}
			
			{/* BYOK info */}
			{info.has_byok && (
				<p className="text-sm text-muted-foreground">
					You are using your own OpenRouter key.
					No credits are consumed.
				</p>
			)}
			
			<Button className="w-full gap-2" asChild>
				<a href="/payment">
					<Plus className="h-4 w-4" />
					{info.is_pro ? "Manage Subscription" : "Buy Credits"}
				</a>
			</Button>
		</div>
	);
}
