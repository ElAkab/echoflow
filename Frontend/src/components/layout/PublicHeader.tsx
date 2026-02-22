"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import NavLink from "@/components/layout/NavLink";

const navLinks = [
	{ href: "/learn-more", label: "Learn More" },
	{ href: "/features", label: "Features" },
	{ href: "/contact", label: "Contact" },
];

export function PublicHeader() {
	const [open, setOpen] = useState(false);

	return (
		<header className="flex items-center px-8 sm:px-16 md:px-32 bg-gradient-to-b dark:from-gray-900/10 dark:to-gray-800/10 backdrop-blur-lg border-b border-gray-700/50 justify-between sticky top-0 py-4 z-50">
			{/* Logo */}
			<div className="flex items-center gap-3">
				<NavLink href="/">
					<span className="text-2xl font-bold text-primary cursor-pointer m-0">
						Echoflow
					</span>
				</NavLink>
				<img
					src="/images/echoflow_logo.png"
					alt="Echoflow Logo"
					className="h-10 w-10 md:h-12 md:w-12"
				/>
			</div>

			{/* Desktop nav */}
			<nav
				className="hidden sm:flex items-center space-x-6 "
				aria-label="Main navigation"
			>
				{navLinks.map((link) => (
					<NavLink key={link.href} href={link.href}>
						{link.label}
					</NavLink>
				))}
			</nav>

			{/* Mobile hamburger */}
			<Sheet open={open} onOpenChange={setOpen}>
				<SheetTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						className="sm:hidden"
						aria-label="Open navigation menu"
					>
						<Menu className="h-5 w-5" />
					</Button>
				</SheetTrigger>
				<SheetContent
					side="right"
					className="w-64 p-0 bg-gradient-to-b dark:from-gray-900/10 dark:to-gray-800/10 backdrop-blur-sm border-b border-gray-700/50"
				>
					<SheetHeader className="p-6 pb-4 flex flex-row items-center justify-between ">
						<SheetTitle className="text-xl font-bold text-primary">
							Navigation
						</SheetTitle>
					</SheetHeader>
					<nav
						className="flex flex-col px-4 gap-1"
						aria-label="Mobile navigation"
					>
						{navLinks.map((link) => (
							<div
								key={link.href}
								onClick={() => setOpen(false)}
								className="w-full"
							>
								<NavLink href={link.href}>
									<span className="block w-full px-3 py-3 rounded-lg text-base hover:bg-gray-800/50 transition-colors">
										{link.label}
									</span>
								</NavLink>
							</div>
						))}
					</nav>
				</SheetContent>
			</Sheet>
		</header>
	);
}
