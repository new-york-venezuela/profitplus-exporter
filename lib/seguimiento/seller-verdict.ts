// Pure status rules and findings for the seller profile scorecard (spec: docs/superpowers/specs/2026-10-15-seller-profile-scorecard-design.md).

export type Status = 'good' | 'warn' | 'bad' | 'none';
export type Severity = 'good' | 'warn' | 'bad';
export interface Finding { severity: Severity; text: string }

/** attainment-style ratio: >= 100% good, 80-99% amber, < 80% red, no goal = none. */
export function ratioStatus(ratio: number | null): Status {
  if (ratio === null) return 'none';
  return ratio >= 1 ? 'good' : ratio >= 0.8 ? 'warn' : 'bad';
}

/** Overdue visits as a share of customers that have a visit frequency. */
export function overdueStatus(overdue: number, withInterval: number): Status {
  if (withInterval <= 0) return 'none';
  const share = overdue / withInterval;
  return share < 0.1 ? 'good' : share < 0.3 ? 'warn' : 'bad';
}

/** Past-due balance (everything outside the 'Current' bucket) as a share of the seller's balance. */
export function agingStatus(pastDueShare: number | null): Status {
  if (pastDueShare === null) return 'none';
  return pastDueShare < 0.2 ? 'good' : pastDueShare < 0.4 ? 'warn' : 'bad';
}

export interface VerdictInput {
  attainment: number | null;
  projectedAttainment: number | null;
  /** Weekly active-customer share for the elapsed weeks, oldest first; null = week without data. */
  weekPcts: (number | null)[];
  overdue: number;
  withInterval: number;
  newCount: number;
  newQuota: number | null;
}

const p = (n: number) => `${Math.round(n * 100)}%`;
const RANK: Record<Severity, number> = { bad: 0, warn: 1, good: 2 };

/** Number of consecutive strictly falling weeks at the end of the series (0 when the last 3 weeks have a gap). */
function fallingStreak(pcts: (number | null)[]): { weeks: number; from: number; to: number } | null {
  if (pcts.length < 3) return null;
  let weeks = 0;
  for (let i = pcts.length - 1; i > 0; i--) {
    const cur = pcts[i];
    const prev = pcts[i - 1];
    if (cur === null || prev === null || !(cur < prev)) break;
    weeks++;
  }
  if (weeks < 2) return null;
  return { weeks, from: pcts[pcts.length - 1 - weeks] as number, to: pcts[pcts.length - 1] as number };
}

export function buildFindings(i: VerdictInput): Finding[] {
  const out: Finding[] = [];
  if (i.projectedAttainment !== null) {
    const status = ratioStatus(i.projectedAttainment);
    const sales = i.attainment === null ? '' : ` (ventas al ${p(i.attainment)})`;
    out.push({
      severity: status === 'good' ? 'good' : status === 'warn' ? 'warn' : 'bad',
      text: status === 'good'
        ? `Va camino a cumplir la meta: proyección al ${p(i.projectedAttainment)}${sales}`
        : `Proyección al cierre al ${p(i.projectedAttainment)} de la meta${sales}`,
    });
  }
  const streak = fallingStreak(i.weekPcts);
  if (streak) out.push({ severity: 'warn', text: `Activación bajó ${streak.weeks} semanas seguidas (de ${p(streak.from)} a ${p(streak.to)})` });
  if (i.overdue > 0 && i.withInterval > 0) {
    out.push({ severity: overdueStatus(i.overdue, i.withInterval) === 'bad' ? 'bad' : 'warn', text: `${i.overdue} visitas vencidas de ${i.withInterval} clientes con frecuencia` });
  }
  if (i.newQuota !== null && i.newCount < i.newQuota) out.push({ severity: 'warn', text: `Nuevos clientes: ${i.newCount} de ${i.newQuota}` });
  return out.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}
