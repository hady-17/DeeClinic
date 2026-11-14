'use client';

import type { Me, Permission } from '@deeclinic/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const LINKS: { href: string; label: string; needs: Permission }[] = [
  { href: '/calendar', label: 'Calendar', needs: 'appointments.read' },
  { href: '/clients', label: 'Clients', needs: 'clients.read' },
  { href: '/services', label: 'Services', needs: 'services.read' },
  { href: '/settings', label: 'Clinic settings', needs: 'settings.read' },
  { href: '/users', label: 'Users', needs: 'users.manage' },
];

/** Shows only the links this person is allowed to use. The API enforces the same rules. */
export function NavLinks() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ data: Me }>('/me')
      .then((r) => !cancelled && setMe(r.data))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!me) return <nav aria-label="Main" className="h-6" />;
  return (
    <nav aria-label="Main" className="flex flex-wrap gap-4">
      {LINKS.filter((l) => me.permissions.includes(l.needs)).map((l) => (
        <Link key={l.href} href={l.href} className="underline">
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
