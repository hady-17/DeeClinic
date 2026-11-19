'use client';

import type { Me, Permission } from '@deeclinic/shared';
import { ROLE_LABELS } from '@deeclinic/shared';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Brand } from '@/components/Brand';
import { BookingProvider, useBooking } from '@/components/BookingProvider';
import { Icon, type IconName } from '@/components/Icon';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Avatar, Button, IconButton, Skeleton, cn } from '@/components/ui';
import { api } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** Shown only to people who hold this permission. Everyone sees the home screen. */
  needs?: Permission;
}

const NAV: { heading: string; items: NavItem[] }[] = [
  {
    heading: 'Daily work',
    items: [
      { href: '/dashboard', label: 'Today', icon: 'home' },
      { href: '/calendar', label: 'Calendar', icon: 'calendar', needs: 'appointments.read' },
      { href: '/clients', label: 'Clients', icon: 'users', needs: 'clients.read' },
    ],
  },
  {
    heading: 'Catalog and money',
    items: [
      { href: '/services', label: 'Services', icon: 'sparkles', needs: 'services.read' },
      { href: '/packages', label: 'Packages', icon: 'box', needs: 'packages.read' },
      { href: '/rates', label: 'Exchange rate', icon: 'coins', needs: 'rates.read' },
    ],
  },
  {
    heading: 'Clinic',
    items: [
      { href: '/users', label: 'Team', icon: 'shield', needs: 'users.manage' },
      { href: '/settings', label: 'Settings', icon: 'sliders', needs: 'settings.read' },
    ],
  },
];

function NavList({ me, onNavigate }: { me: Me | null; onNavigate?: () => void }) {
  const pathname = usePathname();
  if (!me) {
    return (
      <div className="space-y-2 px-3" aria-busy="true" aria-label="Loading menu">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    );
  }
  return (
    <nav aria-label="Main" className="space-y-6">
      {NAV.map((group) => {
        const items = group.items.filter((i) => !i.needs || me.permissions.includes(i.needs));
        if (items.length === 0) return null;
        return (
          <div key={group.heading}>
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-faint">{group.heading}</p>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                        active ? 'bg-primary-soft text-primary-ink' : 'text-muted hover:bg-sunken hover:text-fg',
                      )}
                    >
                      <Icon name={item.icon} size={18} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function AccountBlock({ me, onNavigate }: { me: Me | null; onNavigate?: () => void }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await createClient().auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="space-y-3 border-t border-line p-3">
      <div className="flex items-center gap-3 px-1">
        <Avatar name={me?.fullName ?? ''} size={36} />
        <div className="min-w-0 flex-1">
          {me ? (
            <>
              <p className="truncate text-sm font-medium text-fg">{me.fullName}</p>
              <p className="truncate text-xs text-muted">{ROLE_LABELS[me.role]}</p>
            </>
          ) : (
            <Skeleton className="h-8 w-full" />
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <ThemeToggle />
        <div className="flex items-center">
          {me?.permissions.includes('payments.void') && (
            <Link href="/account" onClick={onNavigate} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-sunken hover:text-fg" aria-label="My passcode" title="My passcode">
              <Icon name="key" />
            </Link>
          )}
          <IconButton icon="logout" label="Sign out" onClick={signOut} disabled={signingOut} />
        </div>
      </div>
    </div>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  const { openBooking } = useBooking();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  // The phone menu is open only on the page it was opened from, so choosing a page closes it
  const [drawerFor, setDrawerFor] = useState<string | null>(null);
  const drawer = drawerFor === pathname;
  const setDrawer = (open: boolean) => setDrawerFor(open ? pathname : null);

  useEffect(() => {
    let cancelled = false;
    api<{ data: Me }>('/me')
      .then((r) => !cancelled && setMe(r.data))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerFor(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawer]);

  const canBook = me?.permissions.includes('appointments.write');

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <a href="#main" className="sr-only z-[70] rounded-lg bg-surface px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:shadow-pop">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface lg:flex">
        <div className="px-5 pb-4 pt-5">
          <Link href="/dashboard" aria-label="DeeClinic home">
            <Brand />
          </Link>
        </div>
        {canBook && (
          <div className="px-4 pb-4">
            <Button variant="primary" icon="plus" className="w-full" onClick={() => openBooking()}>
              New appointment
            </Button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <NavList me={me} />
        </div>
        <AccountBlock me={me} />
      </aside>

      {/* Phone top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface/90 px-3 backdrop-blur lg:hidden">
        <IconButton icon="menu" label="Open menu" onClick={() => setDrawer(true)} aria-expanded={drawer} />
        <Link href="/dashboard" className="mr-auto" aria-label="DeeClinic home">
          <Brand subtitle={false} />
        </Link>
        {canBook && (
          <Button variant="primary" size="sm" icon="plus" onClick={() => openBooking()}>
            New
          </Button>
        )}
      </header>

      {/* Phone drawer */}
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-(--scrim)" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[19rem] max-w-[85vw] animate-[sheet-in_0.18s_ease-out] flex-col bg-surface shadow-pop" aria-label="Menu">
            <div className="flex items-center justify-between px-5 pb-3 pt-4">
              <Brand />
              <IconButton icon="x" label="Close menu" onClick={() => setDrawer(false)} />
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-4 pt-2">
              <NavList me={me} onNavigate={() => setDrawer(false)} />
            </div>
            <AccountBlock me={me} onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <main id="main" className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <BookingProvider>
      <Frame>{children}</Frame>
    </BookingProvider>
  );
}
