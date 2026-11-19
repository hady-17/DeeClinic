import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

/**
 * Calendar days are plain 'yyyy-MM-dd' strings in the clinic's timezone.
 * Appointments are stored in UTC, so every conversion goes through the timezone.
 */

export const DEFAULT_TZ = 'Asia/Beirut';

export function todayStr(tz: string): string {
  return formatInTimeZone(new Date(), tz, 'yyyy-MM-dd');
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing the given day. */
export function weekStart(day: string): string {
  const dow = new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, -((dow + 6) % 7));
}

/** A wall-clock date and time in the clinic timezone, as a UTC instant. */
export function zonedToUtc(day: string, time: string, tz: string): Date {
  return fromZonedTime(`${day}T${time}:00`, tz);
}

export function dayRangeUtc(firstDay: string, dayCount: number, tz: string) {
  return {
    from: zonedToUtc(firstDay, '00:00', tz),
    to: zonedToUtc(addDays(firstDay, dayCount), '00:00', tz),
  };
}

export const dayOf = (iso: string, tz: string) => formatInTimeZone(iso, tz, 'yyyy-MM-dd');
export const timeOf = (iso: string, tz: string) => formatInTimeZone(iso, tz, 'HH:mm');

export function minutesOfDay(iso: string, tz: string): number {
  const [h, m] = timeOf(iso, tz).split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export const formatDayLong = (day: string) =>
  formatInTimeZone(new Date(`${day}T12:00:00Z`), 'UTC', 'EEEE d MMMM yyyy');

export const formatDayShort = (day: string) =>
  formatInTimeZone(new Date(`${day}T12:00:00Z`), 'UTC', 'EEE d MMM');

export const formatDate = (iso: string, tz: string) => formatInTimeZone(iso, tz, 'd MMM yyyy');

/** A package's expiry is the first moment it is invalid, so the last valid day is one minute earlier. */
export const lastValidDay = (expiresAt: string, tz: string) =>
  formatDate(new Date(new Date(expiresAt).getTime() - 60_000).toISOString(), tz);

export const formatDateTime =(iso: string, tz: string) =>
  formatInTimeZone(iso, tz, 'EEE d MMM, HH:mm');
