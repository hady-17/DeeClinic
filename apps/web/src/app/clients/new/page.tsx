'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClientForm } from '@/components/ClientForm';

export default function NewClientPage() {
  const router = useRouter();
  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">New client</h1>
        <Link href="/clients" className="text-sm underline">
          Back to clients
        </Link>
      </header>
      <ClientForm client={null} onSaved={(c) => router.push(`/clients/${c.id}`)} />
    </main>
  );
}
