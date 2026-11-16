export function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

// Signed percentage for deltas: +12.5% / −8.0% (U+2212); an exact zero at one decimal carries no sign.
export function signedPct(n: number): string {
  const body = pct(Math.abs(n));
  if (body === '0.0%') return body;
  return `${n > 0 ? '+' : '−'}${body}`;
}
