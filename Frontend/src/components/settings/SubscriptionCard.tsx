"use client";

import { useState, useEffect } from "react";
import { Crown, Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type SubscriptionStatus = "inactive" | "active" | "cancelled" | "past_due";

interface SubscriptionInfo {
	subscription_status: SubscriptionStatus;
	period_end: string | null;
	cancel_at_period_end: boolean;
}

function formatDate(iso: string) {
	return new Date(iso).toLocaleDateString(undefined, {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

export function SubscriptionCard() {
	const [info, setInfo] = useState<SubscriptionInfo | null>(null);
	const [loading, setLoading] = useState(true);
	const [cancelling, setCancelling] = useState(false);

	useEffect(() => {
		fetch("/api/subscriptions")
			.then((r) => r.json())
			.then(setInfo)
			.catch(() =>
				setInfo({
					subscription_status: "inactive",
					period_end: null,
					cancel_at_period_end: false,
				}),
			)
			.finally(() => setLoading(false));
	}, []);

	const handleCancel = async () => {
		setCancelling(true);
		try {
			const res = await fetch("/api/subscriptions", { method: "DELETE" });
			const data = await res.json();

			if (res.ok || data.devMode) {
				setInfo((prev) =>
					prev ? { ...prev, cancel_at_period_end: true } : null,
				);
			} else {
				console.error("Cancel error:", data.error);
			}
		} finally {
			setCancelling(false);
		}
	};

	return (
		<div className="rounded-lg border p-6 space-y-4">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Crown className="h-5 w-5 text-primary" />
					<h2 className="text-lg font-semibold">Pro Plan</h2>
				</div>
				{!loading && info && <StatusBadge info={info} />}
			</div>

			{loading ? (
				<div className="flex items-center gap-2 text-sm text-muted-foreground">
					<Loader2 className="h-4 w-4 animate-spin" />
					Loading subscription info…
				</div>
			) : (
				<SubscriptionDetails
					info={info}
					cancelling={cancelling}
					onCancel={handleCancel}
				/>
			)}
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ info }: { info: SubscriptionInfo }) {
	if (info.cancel_at_period_end) {
		return (
			<Badge
				variant="secondary"
				className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
			>
				Cancelling
			</Badge>
		);
	}
	switch (info.subscription_status) {
		case "active":
			return <Badge className="bg-green-600">Active</Badge>;
		case "past_due":
			return <Badge variant="destructive">Payment due</Badge>;
		case "cancelled":
			return <Badge variant="secondary">Cancelled</Badge>;
		default:
			return <Badge variant="outline">Free plan</Badge>;
	}
}

function SubscriptionDetails({
	info,
	cancelling,
	onCancel,
}: {
	info: SubscriptionInfo | null;
	cancelling: boolean;
	onCancel: () => Promise<void>;
}) {
	if (!info || info.subscription_status === "inactive") {
		return (
			<div className="space-y-3">
				<p className="text-sm text-muted-foreground">
					You are on the <strong>Free plan</strong> — 20 quizzes/day with
					standard models.
				</p>
				<Button variant="outline" size="sm" asChild>
					<a href="/payment" className="dark:hover:text-primary">
						<Crown className="mr-2 h-4 w-4" />
						Upgrade to Pro — €7/month
					</a>
				</Button>
			</div>
		);
	}

	if (info.subscription_status === "cancelled") {
		return (
			<div className="space-y-3">
				<p className="text-sm text-muted-foreground">
					Your subscription has been cancelled.
					{info.period_end && (
						<>
							{" "}
							Premium access expired on{" "}
							<strong>{formatDate(info.period_end)}</strong>.
						</>
					)}
				</p>
				<Button variant="outline" size="sm" asChild>
					<a href="/payment">
						<Crown className="mr-2 h-4 w-4" />
						Resubscribe
					</a>
				</Button>
			</div>
		);
	}

	if (info.cancel_at_period_end) {
		return (
			<div className="space-y-3">
				<div className="flex items-start gap-2 rounded-md bg-yellow-50 dark:bg-yellow-900/20 p-3">
					<AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
					<p className="text-sm text-yellow-800 dark:text-yellow-300">
						Cancellation scheduled.{" "}
						{info.period_end ? (
							<>
								You will keep Pro access until{" "}
								<strong>{formatDate(info.period_end)}</strong>.
							</>
						) : (
							"You will keep Pro access until the end of your billing period."
						)}
					</p>
				</div>
			</div>
		);
	}

	if (info.subscription_status === "past_due") {
		return (
			<div className="space-y-3">
				<div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3">
					<AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
					<p className="text-sm text-destructive">
						Your last payment failed. Please update your payment method to keep
						Pro access.
					</p>
				</div>
				<Button variant="outline" size="sm" asChild>
					<a
						href="https://billing.stripe.com/p/login"
						target="_blank"
						rel="noopener noreferrer"
					>
						<ExternalLink className="mr-2 h-4 w-4" />
						Manage billing
					</a>
				</Button>
			</div>
		);
	}

	// Active
	return (
		<div className="space-y-4">
			<div className="space-y-2 text-sm">
				<div className="flex justify-between py-1.5 border-b">
					<span className="text-muted-foreground">Plan</span>
					<span className="font-medium">Pro — €7/month</span>
				</div>
				{info.period_end && (
					<div className="flex justify-between py-1.5 border-b">
						<span className="text-muted-foreground">Next renewal</span>
						<span className="font-medium">{formatDate(info.period_end)}</span>
					</div>
				)}
				<div className="flex justify-between py-1.5">
					<span className="text-muted-foreground">Access</span>
					<span className="font-medium text-green-600 dark:text-green-400">
						Unlimited premium quizzes
					</span>
				</div>
			</div>

			<AlertDialog>
				<AlertDialogTrigger asChild>
					<Button
						variant="outline"
						size="sm"
						className="text-destructive border-destructive/30 hover:bg-destructive/5"
					>
						Cancel subscription
					</Button>
				</AlertDialogTrigger>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Cancel your Pro subscription?</AlertDialogTitle>
						<AlertDialogDescription>
							{info.period_end ? (
								<>
									You will keep full Pro access until{" "}
									<strong>{formatDate(info.period_end)}</strong>. After that,
									your account will revert to the free plan.
								</>
							) : (
								"You will keep Pro access until the end of the current billing period."
							)}{" "}
							You can resubscribe at any time.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Keep subscription</AlertDialogCancel>
						<AlertDialogAction
							onClick={onCancel}
							disabled={cancelling}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{cancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Yes, cancel
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
