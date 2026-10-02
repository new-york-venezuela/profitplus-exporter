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

export function parseDecimalInput(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  let normalized: string;
  if (t.includes(',')) {
    if ((t.match(/,/g) ?? []).length > 1) return null;
    normalized = t.replace(/\./g, '').replace(',', '.');
  } else {
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
