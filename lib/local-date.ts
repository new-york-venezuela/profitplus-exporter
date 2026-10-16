// "Today" as the CALENDAR date in the host's timezone (the server runs in America/Caracas, UTC-4), never the UTC date:
// `new Date().toISOString().slice(0, 10)` is already tomorrow after 20:00 in Caracas, which made the month pace
// and the visit-overdue day counts run a day ahead in the evening. No dependencies, so client components can use it.
export function localIsoDate(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function localDateKey(now: Date = new Date()): number {
  return Number(localIsoDate(now).replace(/-/g, ''));
}
