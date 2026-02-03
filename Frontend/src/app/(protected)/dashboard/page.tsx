import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardContent } from '@/components/dashboard/DashboardContent';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Fetch categories with note counts
  const { data: categories } = await supabase
    .from('categories')
    .select('*, notes(count)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return <DashboardContent categories={categories || []} />;
}
