// PROVISIONAL (from Profit Plus KB); confirm against live ERP.
export const EXEMPT_TIPO_IMP = 'E';

export interface LineAgg {
  tipoImp: string;
  base: number;
  iva: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Splits document lines into taxed base, exempt base and IVA. Null when there are no lines. */
export function splitTaxBuckets(
  lines: LineAgg[],
): { base: number; exento: number; iva: number } | null {
  if (lines.length === 0) return null;
  let base = 0;
  let exento = 0;
  let iva = 0;
  for (const l of lines) {
    if (l.tipoImp === EXEMPT_TIPO_IMP) {
      exento += l.base;
    } else {
      base += l.base;
      iva += l.iva;
    }
  }
  return { base: round2(base), exento: round2(exento), iva: round2(iva) };
}
