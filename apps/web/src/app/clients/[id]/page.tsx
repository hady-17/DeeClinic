'use client';

import type { Client } from '@deeclinic/shared';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ClientForm } from '@/components/ClientForm';
import { ClientHistory } from '@/components/ClientHistory';
import { api, ApiError } from '@/lib/api';

export default function ClientPage() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<{ data: Client }>(`/clients/${id}`)
      .then((r) => !cancelled && setClient(r.data))
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof ApiError && e.status === 404 ? 'Client not found.' : 'Could not load the client.');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{client?.fullName ?? 'Client'}</h1>
        <Link href="/clients" className="text-sm underline">
          Back to clients
        </Link>
      </header>

      {error ? (
        <p role="alert" className="text-red-700">{error}</p>
      ) : !client ? (
        <p className="text-stone-500">Loading…</p>
      ) : (
        <>
          <ClientForm
            key={client.updatedAt}
            client={client}
            onSaved={(c) => {
              setClient(c);
              setSaved(true);
            }}
          />
          {saved && <p role="status" className="text-sm text-green-700">Client saved.</p>}
          <ClientHistory clientId={client.id} />
        </>
      )}
    </main>
  );
}
