'use client';

import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { MobileNav } from './MobileNav';

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
              <SheetTitle>Echoflow</SheetTitle>
            </SheetHeader>
            <MobileNav />
          </SheetContent>
        </Sheet>

        {/* Logo (Mobile) */}
        <div className="flex-1 md:hidden">
          <h1 className="text-xl font-bold">Echoflow</h1>
        </div>

        {/* Spacer (Desktop) */}
        <div className="hidden md:flex md:flex-1" />

        {/* Quota Badge */}
        <Badge variant="secondary" className="gap-2">
          <span className="text-xs font-mono">3/3</span>
          <span className="text-xs">hints remaining</span>
        </Badge>
      </div>
    </header>
  );
}
