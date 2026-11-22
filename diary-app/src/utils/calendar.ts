/** Backdated entries use noon; today's entry uses no later than the current time. */
export function calendarEntryDate(year: number, month: number, day: number, now = Date.now()): number | null {
  const start = new Date(year, month, day).getTime();
  if (!Number.isFinite(start) || start > now) return null;
  return Math.min(new Date(year, month, day, 12).getTime(), now);
}
