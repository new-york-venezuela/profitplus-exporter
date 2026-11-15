// PROVISIONAL (from Profit Plus KB); confirm against live ERP.
export const EXEMPT_TIPO_IMP = 'E';

// PROVISIONAL: confirm against live ERP so that base + exento + iva = total_neto (plan Task 1/5).
// KB says reng_neto includes tax; unverified.
export const lineBaseExpr = 'r.reng_neto - ISNULL(r.monto_imp, 0)';

export interface LineAgg {
  tipoImp: string;
  base: number | null;
  iva: number | null;
}

export interface TaxBuckets {
  base: number | null;
  exento: number | null;
  iva: number | null;
}

const toCents = (n: number) => Math.round(n * 100);

/** Sums amounts in integer cents; null if any amount is null (never silently 0). */
function sumCents(values: (number | null)[]): number | null {
  let total = 0;
  for (const v of values) {
    if (v == null) return null;
    total += toCents(v);
  }
  return total / 100;
}

/**
 * Splits document lines into taxed base, exempt base and IVA. Null when there are no lines;
 * a bucket is null when any line feeding it has a null amount.
 */
export function splitTaxBuckets(lines: LineAgg[]): TaxBuckets | null {
  if (lines.length === 0) return null;
  const exempt = lines.filter(l => l.tipoImp === EXEMPT_TIPO_IMP);
  const taxed = lines.filter(l => l.tipoImp !== EXEMPT_TIPO_IMP);
  return {
    base: sumCents(taxed.map(l => l.base)),
    exento: sumCents(exempt.map(l => l.base)),
    iva: sumCents(taxed.map(l => l.iva)),
  };
}
