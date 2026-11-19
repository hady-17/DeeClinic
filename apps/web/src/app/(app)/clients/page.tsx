'use client';

import type { Client, ClientPage } from '@deeclinic/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import { Alert, Avatar, Badge, Button, Card, EmptyState, Input, LinkButton, ListSkeleton, PageHeader } from '@/components/ui';
import { api, describeError } from '@/lib/api';
import { hasPermission, useMe } from '@/lib/hooks';

function buildPath(q: string, cursor?: string | null) {
  const p = new URLSearchParams();
  if (q) p.set('q', q);
  if (cursor) p.set('cursor', cursor);
  const s = p.toString();
  return `/clients${s ? `?${s}` : ''}`;
}

export default function ClientsPage() {
  const me = useMe();
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wait for the person to stop typing before searching
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
      .catch((e) => !cancelled && setError(describeError(e, 'Could not load clients.')))
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
      setError(describeError(e, 'Could not load more clients.'));
    } finally {
      setLoadingMore(false);
    }
  }

  const canWrite = hasPermission(me, 'clients.write');
  const canImport = hasPermission(me, 'clients.import');

  return (
    <>
      <PageHeader
        title="Clients"
        description="Search by name or phone number, or open a client to see their visits, packages and payments."
        actions={
          <>
            {canImport && (
              <LinkButton href="/clients/import" icon="upload">
                Import CSV
              </LinkButton>
            )}
            {canWrite && (
              <LinkButton href="/clients/new" variant="primary" icon="userPlus">
                Add client
              </LinkButton>
            )}
          </>
        }
      />

      <div className="relative mb-4 max-w-md">
        <Icon name="search" size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <Input
          aria-label="Search clients by name or phone"
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search by name or phone"
          className="pl-10"
        />
      </div>

      {error && <Alert tone="bad" className="mb-4">{error}</Alert>}

      {!loaded ? (
        <ListSkeleton rows={6} />
      ) : clients.length === 0 ? (
        <EmptyState
          icon="users"
          title={q ? 'No clients match your search' : 'No clients yet'}
          description={q ? 'Check the spelling, or try part of the phone number.' : 'Add your first client, or import your existing list from a CSV file.'}
          action={
            !q && canWrite ? (
              <LinkButton href="/clients/new" variant="primary" icon="userPlus">
                Add a client
              </LinkButton>
            ) : undefined
          }
        />
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {clients.map((c) => (
            <Link key={c.id} href={`/clients/${c.id}`} className="flex items-center gap-3.5 p-4 transition-colors hover:bg-sunken">
              <Avatar name={c.fullName} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-fg">{c.fullName}</p>
                <p className="truncate text-sm text-muted">{c.phoneE164}</p>
              </div>
              {c.whatsappOptOutAt ? (
                <Badge tone="bad">Opted out</Badge>
              ) : c.whatsappConsentAt ? (
                <Badge tone="ok" className="hidden sm:inline-flex">WhatsApp OK</Badge>
              ) : (
                <Badge tone="neutral" className="hidden sm:inline-flex">No WhatsApp consent</Badge>
              )}
              <Icon name="chevronRight" size={16} className="text-faint" />
            </Link>
          ))}
        </Card>
      )}

      {nextCursor && (
        <div className="mt-4 flex justify-center">
          <Button onClick={loadMore} loading={loadingMore}>
            Load more
          </Button>
        </div>
      )}
    </>
  );
}
