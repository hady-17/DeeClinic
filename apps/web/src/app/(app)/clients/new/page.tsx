'use client';

import { useRouter } from 'next/navigation';
import { ClientForm } from '@/components/ClientForm';
import { useToast } from '@/components/Toast';
import { Card, PageHeader } from '@/components/ui';

export default function NewClientPage() {
  const router = useRouter();
  const toast = useToast();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New client" description="Only a name and a phone number are required." back={{ href: '/clients', label: 'Clients' }} />
      <Card className="p-5 sm:p-6">
        <ClientForm
          client={null}
          submitLabel="Add client"
          onSaved={(c) => {
            toast.show(`${c.fullName} added`);
            router.push(`/clients/${c.id}`);
          }}
        />
      </Card>
    </div>
  );
}
