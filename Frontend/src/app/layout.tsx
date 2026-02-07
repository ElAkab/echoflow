// layout.tsx : Defines the root layout for the Next.js application, including metadata and global styles.

import type { Metadata } from "next";

import "./globals.css";

// Metadata for the application, including title and description.
export const metadata: Metadata = {
	title: "Echoflow - AI-Powered Learning",
	description:
		"Master your knowledge with AI-generated quizzes from your notes",
};

// Root layout component that wraps all pages in the application.
export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className="dark">
			<body className="antialiased">{children}</body>
		</html>
	);
}
