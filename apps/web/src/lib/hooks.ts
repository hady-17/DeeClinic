'use client';

import type { ClinicSettings, Me, Permission } from '@deeclinic/shared';
import { useEffect, useState } from 'react';
import { api } from './api';
import { DEFAULT_TZ } from './time';

/** The signed-in person and what they may do. null while loading. */
export function useMe(): Me | null {
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
  return me;
}

export const hasPermission = (me: Me | null, permission: Permission) =>
  Boolean(me?.permissions.includes(permission));

/** The clinic's timezone, for showing dates. Falls back to Beirut until it loads. */
export function useClinicTz(): string {
  const [tz, setTz] = useState(DEFAULT_TZ);
  useEffect(() => {
    let cancelled = false;
    api<{ data: ClinicSettings | null }>('/clinic-settings')
      .then((r) => !cancelled && r.data?.timezone && setTz(r.data.timezone))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return tz;
}
