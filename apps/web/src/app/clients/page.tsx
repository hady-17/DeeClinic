'use client';

import type { Client, ClientPage } from '@deeclinic/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

function buildPath(q: string, cursor?: string | null) {
  const p = new URLSearchParams();
  if (q) p.set('q', q);
  if (cursor) p.set('cursor', cursor);
  const s = p.toString();
  return `/clients${s ? `?${s}` : ''}`;
}

export default function ClientsPage() {
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wait for the owner to stop typing before searching
  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);

  useEffect(() => {
    let cancelled = false;
    api<ClientPage>(buildPath(q))
      .then((r) => {
        if (cancelled) return;
        setClients(r.data);
        setNextCursor(r.nextCursor);
        setError(null);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Could not load clients.'))
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [q]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const r = await api<ClientPage>(buildPath(q, nextCursor));
      setClients((prev) => [...prev, ...r.data]);
      setNextCursor(r.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load more clients.');
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Clients</h1>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm underline">
            Dashboard
          </Link>
          <Link href="/clients/new" className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white">
            Add client
          </Link>
        </div>
      </header>

      <div>
        <label htmlFor="search" className="sr-only">
          Search by name or phone
        </label>
        <input
          id="search"
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search by name or phone"
          className="w-full rounded-md border border-stone-300 px-3 py-2"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      {!loaded ? (
        <p className="text-stone-500">Loading…</p>
      ) : clients.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-stone-500">
          {q ? 'No clients match your search.' : 'No clients yet. Add the first one.'}
        </p>
      ) : (
        <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
          {clients.map((c) => (
            <li key={c.id}>
              <Link href={`/clients/${c.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-stone-50">
                <div>
                  <p className="font-medium">{c.fullName}</p>
                  <p className="text-sm text-stone-600">{c.phoneE164}</p>
                </div>
                {c.whatsappOptOutAt ? (
                  <span className="text-xs text-amber-800">Opted out</span>
                ) : !c.whatsappConsentAt ? (
                  <span className="text-xs text-stone-500">No WhatsApp consent</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {nextCursor && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm disabled:opacity-60"
        >
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
    </main>
  );
}
