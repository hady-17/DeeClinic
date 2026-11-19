'use client';

import type { Appointment } from '@deeclinic/shared';
import { useState } from 'react';
import { AppointmentDetails } from '@/components/AppointmentDetails';
import { AppointmentForm } from '@/components/AppointmentForm';
import { Modal } from '@/components/Modal';

/** Opens an appointment, and switches to rescheduling in the same dialog. */
export function AppointmentModal({
  appointment,
  tz,
  onClose,
  onChanged,
}: {
  appointment: Appointment;
  tz: string;
  onClose: () => void;
  /** Called after any change (completed, cancelled, moved, ...), so the caller can reload */
  onChanged: (message: string) => void;
}) {
  const [mode, setMode] = useState<'details' | 'edit'>('details');

  return (
    <Modal
      title={mode === 'details' ? 'Appointment' : 'Reschedule appointment'}
      description={mode === 'edit' ? 'Change the time, service or notes.' : undefined}
      onClose={onClose}
      size="lg"
    >
      {mode === 'details' ? (
        <AppointmentDetails
          appointment={appointment}
          tz={tz}
          onChanged={(message) => onChanged(message)}
          onEdit={() => setMode('edit')}
        />
      ) : (
        <AppointmentForm
          tz={tz}
          appointment={appointment}
          onSaved={() => onChanged('Appointment updated')}
          onCancel={() => setMode('details')}
        />
      )}
    </Modal>
  );
}
