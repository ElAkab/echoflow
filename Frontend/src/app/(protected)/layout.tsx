import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/AppShell';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Dashboard - Brain Loop',
  description: 'Manage your learning with AI-powered active recall',
};

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
