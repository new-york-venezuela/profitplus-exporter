export function pct(n: number | null): string {
  if (n === null) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

export function num(n: number): string {
  return new Intl.NumberFormat('es-VE', { maximumFractionDigits: 2 }).format(n);
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('es-VE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
}

// USD ignores a null side and is null only when both are null (same convention as sumDuals in lib/seguimiento).
export function addDuals(a: { bs: number; usd: number | null }, b: { bs: number; usd: number | null }): { bs: number; usd: number | null } {
  return { bs: a.bs + b.bs, usd: a.usd === null && b.usd === null ? null : (a.usd ?? 0) + (b.usd ?? 0) };
}
