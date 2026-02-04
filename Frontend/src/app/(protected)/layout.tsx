import React from 'react';
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
  return (
    <AppShell>
      <React.Suspense fallback={<div className="h-full flex items-center justify-center">Loading...</div>}>
        {children}
      </React.Suspense>
    </AppShell>
  );
}
