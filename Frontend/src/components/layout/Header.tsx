"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { MobileNav } from "./MobileNav";
import { CreditDisplay } from "@/components/credits/CreditDisplay";

export function Header() {
	return (
		<header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			<div className="flex h-16 items-center px-4 gap-4">
				{/* Mobile Menu */}
				<Sheet>
					<SheetTrigger asChild>
						<Button variant="ghost" size="icon" className="md:hidden">
							<Menu className="h-5 w-5" />
							<span className="sr-only">Toggle menu</span>
						</Button>
					</SheetTrigger>
					<SheetContent side="left" className="w-64 p-0">
						<SheetHeader className="p-6 pb-0">
							<SheetTitle className="text-2xl font-bold text-primary cursor-pointer">
								Echoflow
							</SheetTitle>
						</SheetHeader>
						<MobileNav />
					</SheetContent>
				</Sheet>

				{/* Logo (Mobile) */}
				<div className="flex-1 md:hidden flex items-center gap-2">
					<img
						src="/images/echoflow_logo.png"
						alt="Echoflow"
						className="h-8 w-8"
					/>
					<h1 className="text-xl font-bold text-primary bg-gradient-to-tr dark:from-primary to-[#053f61] bg-clip-text text-transparent cursor-pointer">
						Echoflow
					</h1>
				</div>

				{/* Spacer (Desktop) */}
				<div className="hidden md:flex md:flex-1" />

				{/* Credit Balance */}
				<CreditDisplay />
			</div>
		</header>
	);
}
