import { addDays, daysBetween, parseIso, toIso } from './iso-date';

// Weekends only; holidays are not modelled (spec decision "Working days").
export function isWorkingDay(isoDate: string): boolean {
  const dow = parseIso(isoDate).getUTCDay();
  return dow !== 0 && dow !== 6;
}

const MONTH = /^(\d{4})-(\d{2})$/;

export function isValidMonth(month: string): boolean {
  const m = MONTH.exec(month);
  return !!m && Number(m[2]) >= 1 && Number(m[2]) <= 12;
}

export function monthBounds(month: string): { start: string; end: string } {
  const m = MONTH.exec(month);
  if (!m || !isValidMonth(month)) throw new Error(`Mes inválido '${month}'; se esperaba YYYY-MM`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  return { start: toIso(new Date(Date.UTC(y, mo - 1, 1))), end: toIso(new Date(Date.UTC(y, mo, 0))) };
}

export function countWorkingDays(from: string, to: string): number {
  const span = daysBetween(from, to);
  let n = 0;
  for (let i = 0; i <= span; i++) if (isWorkingDay(addDays(from, i))) n++;
  return n;
}

export interface MonthPace {
  month: string;
  asOf: string;
  workingDaysInMonth: number;
  workingDaysElapsed: number;
  workingDaysRemaining: number;
  fractionElapsed: number;
}

// "Elapsed" = working days from the 1st through asOf, inclusive (today counts).
// asOf is clamped into the month: before it => 0 elapsed, after it => the whole month.
export function monthPace(month: string, asOf: string): MonthPace {
  const { start, end } = monthBounds(month);
  const workingDaysInMonth = countWorkingDays(start, end);
  const effectiveEnd = asOf < end ? asOf : end;
  const workingDaysElapsed = effectiveEnd < start ? 0 : countWorkingDays(start, effectiveEnd);
  return {
    month, asOf, workingDaysInMonth, workingDaysElapsed,
    workingDaysRemaining: workingDaysInMonth - workingDaysElapsed,
    fractionElapsed: workingDaysElapsed / workingDaysInMonth,
  };
}

// Spec: projection = actual / (working days elapsed / working days in month).
export function projectToMonth(
  actual: number | null,
  pace: Pick<MonthPace, 'workingDaysInMonth' | 'workingDaysElapsed'>,
): number | null {
  if (actual === null || pace.workingDaysElapsed <= 0) return null;
  return (actual * pace.workingDaysInMonth) / pace.workingDaysElapsed;
}

export interface ReferenceMonth { month: string; monthStart: string; monthEnd: string; asOf: string }

const CUSTOM_END = /^custom:\d{4}-\d{2}-\d{2}:(\d{4}-\d{2}-\d{2})$/;
const MONTH_RANGE = /^month:(\d{4}-\d{2})$/;
const YTD_RANGE = /^ytd:(\d{4})$/;

// Seguimiento is a monthly scorecard (monthly quotas, ISO weeks, month projection). The shell's
// dateRange is mapped to ONE reference month: the month the range ends in, and "as of" the
// earliest of today, the range end and the month end.
export function resolveReferenceMonth(dateRange: string, today: string): ReferenceMonth {
  let month = today.slice(0, 7);
  let rangeEnd = today;
  const custom = CUSTOM_END.exec(dateRange);
  const monthRange = MONTH_RANGE.exec(dateRange);
  const ytd = YTD_RANGE.exec(dateRange);
  if (custom) {
    month = custom[1].slice(0, 7);
    rangeEnd = custom[1];
  } else if (monthRange) {
    month = monthRange[1];
    rangeEnd = isValidMonth(month) ? monthBounds(month).end : today;
  } else if (ytd && ytd[1] !== today.slice(0, 4)) {
    month = `${ytd[1]}-12`;
    rangeEnd = `${ytd[1]}-12-31`;
  }
  if (!isValidMonth(month)) {
    month = today.slice(0, 7);
    rangeEnd = today;
  }
  const { start, end } = monthBounds(month);
  const asOf = [today, rangeEnd, end].reduce((a, b) => (a < b ? a : b));
  return { month, monthStart: start, monthEnd: end, asOf };
}
