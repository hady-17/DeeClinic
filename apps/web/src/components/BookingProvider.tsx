'use client';

import type { Client } from '@deeclinic/shared';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AppointmentForm } from '@/components/AppointmentForm';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { useClinicTz } from '@/lib/hooks';
import { todayStr } from '@/lib/time';

export interface BookingPreset {
  client?: Pick<Client, 'id' | 'fullName' | 'phoneE164'>;
  date?: string;
  time?: string;
}

const BookingContext = createContext<{ openBooking: (preset?: BookingPreset) => void }>({ openBooking: () => undefined });

/** Start a booking from anywhere in the app (the sidebar button, a client page, the calendar). */
export const useBooking = () => useContext(BookingContext);

/** Screens that show appointments listen for this and reload. */
export const APPOINTMENTS_CHANGED = 'appointments:changed';

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const tz = useClinicTz();
  const toast = useToast();
  const [preset, setPreset] = useState<BookingPreset | null>(null);

  const openBooking = useCallback((p: BookingPreset = {}) => setPreset(p), []);
  const close = useCallback(() => setPreset(null), []);
  const value = useMemo(() => ({ openBooking }), [openBooking]);

  return (
    <BookingContext.Provider value={value}>
      {children}
      {preset && (
        <Modal title="New appointment" description="Pick a client, a service and a time." onClose={close}>
          <AppointmentForm
            tz={tz}
            presetClient={preset.client}
            initial={{ date: preset.date ?? todayStr(tz), time: preset.time ?? '09:00' }}
            onCancel={close}
            onSaved={() => {
              close();
              toast.show('Appointment booked');
              window.dispatchEvent(new Event(APPOINTMENTS_CHANGED));
            }}
          />
        </Modal>
      )}
    </BookingContext.Provider>
  );
}
