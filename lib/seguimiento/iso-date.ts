// Pure UTC date arithmetic on 'YYYY-MM-DD' strings. No library, no local time zone
// (AGENTS.md: "No date library"; lib/dates.ts is month-range oriented, this is day-level).
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIso(d: string): Date {
  const m = ISO.exec(d);
  if (!m) throw new Error(`Fecha inválida '${d}'; se esperaba YYYY-MM-DD`);
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (date.toISOString().slice(0, 10) !== d) throw new Error(`Fecha inválida '${d}'`);
  return date;
}

export function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: string, n: number): string {
  const x = parseIso(d);
  x.setUTCDate(x.getUTCDate() + n);
  return toIso(x);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseIso(to).getTime() - parseIso(from).getTime()) / 86_400_000);
}
