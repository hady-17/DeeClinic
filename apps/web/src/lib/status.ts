import type { AppointmentStatus } from '@deeclinic/shared';
import type { Tone } from '@/components/ui';

/** One place that decides how an appointment status reads and what colour it carries. */
export const APPOINTMENT_STATUS: Record<AppointmentStatus, { label: string; tone: Tone; block: string; dot: string }> = {
  scheduled: { label: 'Scheduled', tone: 'info', block: 'border-info bg-info-soft text-info-ink', dot: 'bg-info' },
  confirmed: { label: 'Confirmed', tone: 'primary', block: 'border-primary bg-primary-soft text-primary-ink', dot: 'bg-primary' },
  completed: { label: 'Completed', tone: 'ok', block: 'border-ok bg-ok-soft text-ok-ink', dot: 'bg-ok' },
  no_show: { label: 'No-show', tone: 'bad', block: 'border-bad bg-bad-soft text-bad-ink opacity-90', dot: 'bg-bad' },
  cancelled: { label: 'Cancelled', tone: 'neutral', block: 'hidden', dot: 'bg-faint' },
};
