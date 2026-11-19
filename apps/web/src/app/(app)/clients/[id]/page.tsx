'use client';

import { CLIENT_SOURCE_LABELS, type Client } from '@deeclinic/shared';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useBooking } from '@/components/BookingProvider';
import { ClientForm } from '@/components/ClientForm';
import { ClientHistory } from '@/components/ClientHistory';
import { ClientMoney } from '@/components/ClientMoney';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/Toast';
import { Alert, Avatar, Badge, Button, Card, PageHeader, Skeleton, Tabs } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { hasPermission, useMe } from '@/lib/hooks';

type Tab = 'visits' | 'money' | 'profile';

export default function ClientPage() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const toast = useToast();
  const { openBooking } = useBooking();
  const [client, setClient] = useState<Client | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('visits');

  useEffect(() => {
    let cancelled = false;
    api<{ data: Client }>(`/clients/${id}`)
      .then((r) => !cancelled && setClient(r.data))
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof ApiError && e.status === 404 ? 'This client was not found.' : 'Could not load the client.');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <>
        <PageHeader title="Client" back={{ href: '/clients', label: 'Clients' }} />
        <Alert tone="bad">{error}</Alert>
      </>
    );
  }

  if (!client) {
    return (
      <>
        <PageHeader title={<Skeleton className="h-8 w-56" />} back={{ href: '/clients', label: 'Clients' }} />
        <Skeleton className="h-64 w-full" />
      </>
    );
  }

  const canBook = hasPermission(me, 'appointments.write');
  const consent = client.whatsappOptOutAt ? (
    <Badge tone="bad">Opted out of WhatsApp</Badge>
  ) : client.whatsappConsentAt ? (
    <Badge tone="ok">WhatsApp OK</Badge>
  ) : (
    <Badge tone="neutral">No WhatsApp consent</Badge>
  );

  return (
    <>
      <PageHeader
        back={{ href: '/clients', label: 'Clients' }}
        title={
          <span className="flex items-center gap-3.5">
            <Avatar name={client.fullName} size={48} />
            <span className="truncate">{client.fullName}</span>
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <a href={`tel:${client.phoneE164}`} className="inline-flex items-center gap-1.5 text-fg hover:underline">
              <Icon name="phone" size={14} /> {client.phoneE164}
            </a>
            {client.instagramHandle && <span>@{client.instagramHandle}</span>}
            {client.source && <span>via {CLIENT_SOURCE_LABELS[client.source]}</span>}
            {consent}
          </span>
        }
        actions={
          canBook && (
            <Button
              variant="primary"
              icon="plus"
              onClick={() => openBooking({ client: { id: client.id, fullName: client.fullName, phoneE164: client.phoneE164 } })}
            >
              Book appointment
            </Button>
          )
        }
      />

      {client.notes && (
        <Card className="mb-6 flex items-start gap-3 p-4 text-sm">
          <Icon name="file" size={17} className="mt-0.5 shrink-0 text-muted" />
          <p className="whitespace-pre-wrap text-fg">{client.notes}</p>
        </Card>
      )}

      <Tabs
        label="Client sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'visits', label: 'Visits' },
          { value: 'money', label: 'Packages and payments' },
          { value: 'profile', label: 'Profile' },
        ]}
      />

      <div className="pt-6">
        {tab === 'visits' && <ClientHistory clientId={client.id} />}
        {tab === 'money' && <ClientMoney clientId={client.id} />}
        {tab === 'profile' && (
          <Card className="max-w-2xl p-5 sm:p-6">
            <ClientForm
              key={client.updatedAt}
              client={client}
              onSaved={(c) => {
                setClient(c);
                toast.show('Client saved');
              }}
            />
          </Card>
        )}
      </div>
    </>
  );
}
