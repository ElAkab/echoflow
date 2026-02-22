// layout.tsx : Defines the root layout for the Next.js application, including metadata and global styles.

import type { Metadata, Viewport } from "next";

import "./globals.css";

// Viewport configuration for responsive design on mobile devices
export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
};

// Metadata for the application, including title and description.
export const metadata: Metadata = {
	title: "Echoflow - AI-Powered Learning",
	description:
		"Master your knowledge with AI-generated quizzes from your notes",
	icons: {
		icon: "/images/echoflow_logo.ico",
		apple: "/images/echoflow_logo.ico",
	},
	openGraph: {
		title: "Echoflow - AI-Powered Learning",
		description:
			"Master your knowledge with AI-generated quizzes from your notes",
		url: process.env.NEXT_PUBLIC_APP_URL,
		siteName: "Echoflow",
		images: [
			{
				url: "/images/thumbnail.png",
				width: 1920,
				height: 1080,
				alt: "Echoflow - AI-Powered Learning",
			},
		],
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "Echoflow - AI-Powered Learning",
		description:
			"Master your knowledge with AI-generated quizzes from your notes",
		images: ["/images/thumbnail.png"],
	},
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
