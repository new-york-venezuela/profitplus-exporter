import type { Money, Statement, StatementDoc, StatementRow, UsdRate } from './types';

const DEBT_TYPES = new Set(['FACT', 'N/DB']);
const REDUCING_TYPES = new Set(['N/CR', 'NCR', 'ADEL']);

/** Local date-only key (YYYY-MM-DD); string order equals date order. */
function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function dayNumber(d: Date): number {
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

/** Latest rate whose date (date-only) is on or before the issue day, else null. */
export function resolveUsdRate(rates: UsdRate[], issueDate: Date): number | null {
  const issue = dayKey(issueDate);
  let best: UsdRate | null = null;
  for (const r of rates) {
    if (dayKey(r.fecha) > issue) continue;
    if (!best || r.fecha.getTime() > best.fecha.getTime()) best = r;
  }
  return best ? best.tasaV : null;
}

const zero = (): Money => ({ bsd: 0, usd: 0 });

function bucketKey(days: number | null): 'porVencer' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90plus' {
  if (days === null || days <= 0) return 'porVencer';
  if (days <= 30) return 'd1_30';
  if (days <= 60) return 'd31_60';
  if (days <= 90) return 'd61_90';
  return 'd90plus';
}

export function buildStatement(docs: StatementDoc[], rates: UsdRate[], asOf: Date): Statement {
  const aging = {
    porVencer: zero(),
    d1_30: zero(),
    d31_60: zero(),
    d61_90: zero(),
    d90plus: zero(),
  };
  const credits = zero();
  const total = zero();
  let incomplete = false;

  const rows: StatementRow[] = docs.map((doc) => {
    const isDebt = DEBT_TYPES.has(doc.coTipoDoc);
    const unknownType = !isDebt && !REDUCING_TYPES.has(doc.coTipoDoc);
    const sign = isDebt ? 1 : -1;
    const rate = resolveUsdRate(rates, doc.fecEmis);
    const amountBsd = sign * doc.saldoBsd;
    const amountUsd = rate === null ? null : amountBsd / rate;
    if (amountUsd === null) incomplete = true;
    const daysOverdue =
      isDebt && doc.fecVenc ? dayNumber(asOf) - dayNumber(doc.fecVenc) : null;

    total.bsd += amountBsd;
    total.usd += amountUsd ?? 0;
    const target = isDebt ? aging[bucketKey(daysOverdue)] : credits;
    target.bsd += amountBsd;
    target.usd += amountUsd ?? 0;

    return {
      kind: isDebt ? 'debt' : 'reducing',
      coTipoDoc: doc.coTipoDoc,
      nroDoc: doc.nroDoc,
      fecEmis: doc.fecEmis,
      fecVenc: doc.fecVenc,
      daysOverdue,
      amountBsd,
      rate,
      amountUsd,
      unknownType,
    };
  });

  const venc = (r: StatementRow) => (r.fecVenc ? r.fecVenc.getTime() : Infinity);
  rows.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'debt' ? -1 : 1;
    return venc(a) - venc(b);
  });

  return { asOf, rows, aging, credits, total, incomplete };
}
