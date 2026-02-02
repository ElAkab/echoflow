import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const hintsUsed = profile?.hint_credits || 0;
  const hintsRemaining = 3 - hintsUsed;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome back! 👋</h1>
        <p className="text-muted-foreground">
          Ready to boost your learning today?
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-3xl">📝</span>
            <span className="text-xs text-muted-foreground">Total</span>
          </div>
          <div className="text-2xl font-bold">0</div>
          <div className="text-sm text-muted-foreground">Notes created</div>
        </div>

        <div className="rounded-lg border p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-3xl">📚</span>
            <span className="text-xs text-muted-foreground">Total</span>
          </div>
          <div className="text-2xl font-bold">0</div>
          <div className="text-sm text-muted-foreground">Categories</div>
        </div>

        <div className="rounded-lg border p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-3xl">⚡</span>
            <span className="text-xs text-muted-foreground">This week</span>
          </div>
          <div className="text-2xl font-bold">{hintsRemaining}</div>
          <div className="text-sm text-muted-foreground">Hints remaining</div>
        </div>
      </div>

      <div className="rounded-lg border p-8 text-center space-y-4">
        <h2 className="text-2xl font-bold">🚀 Get Started</h2>
        <p className="text-muted-foreground">
          Create your first category to start organizing your notes
        </p>
        <Button size="lg">Create First Category</Button>
      </div>
    </div>
  );
}
