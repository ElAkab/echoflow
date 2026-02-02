'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Settings, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { signOut } from '@/lib/auth/actions';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/profile', label: 'Profile', icon: User },
];

export function Sidebar() {
  const pathname = usePathname();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <aside className="hidden md:flex w-64 flex-col border-r bg-background">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-primary">Brain Loop</h1>
        <p className="text-sm text-muted-foreground">Active Recall Learning</p>
      </div>

      <Separator />

      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive ? 'secondary' : 'ghost'}
                className="w-full justify-start"
              >
                <Icon className="mr-2 h-4 w-4" />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </nav>

      <Separator />

      <div className="p-4">
        <Button
          variant="ghost"
          className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleSignOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </aside>
  );
}
