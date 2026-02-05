// This file defines the layout for all protected routes in the application. It wraps the content in an AppShell component that includes the header and sidebar, and provides a consistent layout for all authenticated pages.

import React from "react";
import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import "../globals.css";

export const metadata: Metadata = {
	title: "Dashboard - Brain Loop",
	description: "Manage your learning with AI-powered active recall",
};

export default function ProtectedLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<AppShell>
			<React.Suspense
				fallback={
					<div className="h-full flex items-center justify-center">
						Loading...
					</div>
				}
			>
				{children}
			</React.Suspense>
		</AppShell>
	);
}
