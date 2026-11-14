import { redirect } from 'next/navigation';
import { NavLinks } from '@/components/NavLinks';
import { createClient } from '@/lib/supabase/server';

async function signOut() {
  'use server';
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <form action={signOut}>
          <button type="submit" className="rounded-md border border-stone-300 px-3 py-1.5 text-sm">
            Sign out
          </button>
        </form>
      </header>
      <p className="text-stone-600">Signed in as {user?.email}.</p>
      <NavLinks />
      <section className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-stone-500">
        Nothing here yet. Appointments, clients and payments arrive in the next phases.
      </section>
    </main>
  );
}
