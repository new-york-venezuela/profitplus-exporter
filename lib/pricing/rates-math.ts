export function roundHalfUp(n: number, dp = 2): number {
  if (!Number.isFinite(n)) return n;
  const shifted = Math.round(Number(`${n.toFixed(10)}e${dp}`));
  return Number(`${shifted}e-${dp}`);
}

export function priceFromPercent(ref: number, pct: number): number {
  return roundHalfUp(ref * (1 + pct / 100), 2);
}

export function percentFromPrice(ref: number | null, price: number): number | null {
  if (ref === null || !(ref > 0)) return null;
  return roundHalfUp((price / ref - 1) * 100, 2);
}

const THOUSANDS_NO_COMMA = /^\d{1,3}(\.\d{3})+$/;
export const COMMA_HINT = 'Use coma para los decimales (ej. 12,40)';

/** Price typed in a grid cell: what is shown (2 decimals, half-up) is what is staged and sent. */
export function parsePriceCell(text: string): { ok: true; value: number } | { ok: false; message: string } {
  const n = parseDecimalInput(text);
  if (n === null) return { ok: false, message: THOUSANDS_NO_COMMA.test(text.trim()) ? COMMA_HINT : 'Precio inválido' };
  const value = roundHalfUp(n, 2);
  return value > 0 ? { ok: true, value } : { ok: false, message: 'Precio inválido' };
}

export function parseDecimalInput(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  let normalized: string;
  if (t.includes(',')) {
    if ((t.match(/,/g) ?? []).length > 1) return null;
    normalized = t.replace(/\./g, '').replace(',', '.');
  } else {
    // "1.250" / "12.500" with no comma read as Spanish thousands: ambiguous, so reject (use a comma for decimals)
    if (THOUSANDS_NO_COMMA.test(t)) return null;
    normalized = t;
  }
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function parsePercentInput(text: string): number | null {
  return parseDecimalInput(text.replace(/%/g, '').replace(/^\+/, '').trim());
}

export function bulkNewPrices(
  rows: { coArt: string; reference: number | null }[],
  op: { type: 'percent'; pct: number } | { type: 'set'; monto: number },
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const price = op.type === 'set' ? roundHalfUp(op.monto, 2) : r.reference === null ? null : priceFromPercent(r.reference, op.pct);
    if (price !== null && price > 0) out[r.coArt] = price;
  }
  return out;
}
