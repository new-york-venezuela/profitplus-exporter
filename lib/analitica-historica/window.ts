// Date-window maths for the Analítica histórica section. Everything here is
// pure and works on YYYYMMDD integer keys (the DateKey convention of the DWH).
// buildDateWhereClause in app/api/dwh/lib/query-builder.ts is deliberately NOT
// used: it anchors '30d' / '12m' / current-year ytd to GETDATE(), but this
// section's relative ranges are anchored to the END OF THE LEGACY DATA.

export const HIST_START_KEY = 20200101;
// Last day with legacy data. Matches IMPORT_END_DATE in
// scripts/dwh-legacy-2025-import.ts; update both if the data ever extends.
export const HIST_END_KEY = 20260228;

export interface HistRange { startKey: number; endKey: number }
export interface ResolvedHistRange extends HistRange { empty: boolean }

const CUSTOM_RE = /^custom:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/;
const MONTH_RE = /^month:(\d{4})-(\d{2})$/;
const YTD_RE = /^ytd:(\d{4})$/;
const DAY_MS = 86_400_000;

export function keyToIso(key: number): string {
  const s = String(key);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function keyToDate(key: number): Date {
  return new Date(Date.UTC(Math.floor(key / 10000), Math.floor((key % 10000) / 100) - 1, key % 100));
}

function dateToKey(d: Date): number {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

function addDays(key: number, days: number): number {
  return dateToKey(new Date(keyToDate(key).getTime() + days * DAY_MS));
}

// Returns NaN for a string that is not a real calendar date (e.g. 2024-13-45).
export function isoToKey(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return NaN;
  const [y, mo, d] = [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return NaN;
  return y * 10000 + mo * 100 + d;
}

function monthEndKey(year: number, month: number): number {
  return dateToKey(new Date(Date.UTC(year, month, 0)));
}

function clamp(start: number, end: number): ResolvedHistRange {
  if (start > end) [start, end] = [end, start];
  const s = Math.max(start, HIST_START_KEY);
  const e = Math.min(end, HIST_END_KEY);
  return s > e ? { startKey: s, endKey: e, empty: true } : { startKey: s, endKey: e, empty: false };
}

function trailing(days: number): ResolvedHistRange {
  return clamp(addDays(HIST_END_KEY, -(days - 1)), HIST_END_KEY);
}

// Resolves any dateRange URL value to a concrete, window-clamped key range.
// '30d' / '12m' (365 days) end at HIST_END_KEY; unknown or impossible values
// fall back to '12m' so a stale link degrades instead of erroring.
export function resolveHistRange(dateRange: string): ResolvedHistRange {
  const custom = CUSTOM_RE.exec(dateRange);
  if (custom) {
    const a = isoToKey(custom[1]);
    const b = isoToKey(custom[2]);
    return Number.isNaN(a) || Number.isNaN(b) ? trailing(365) : clamp(a, b);
  }
  const month = MONTH_RE.exec(dateRange);
  if (month) {
    const y = parseInt(month[1]);
    const m = parseInt(month[2]);
    if (m < 1 || m > 12) return trailing(365);
    return clamp(y * 10000 + m * 100 + 1, monthEndKey(y, m));
  }
  const ytd = YTD_RE.exec(dateRange);
  if (ytd) {
    const y = parseInt(ytd[1]);
    return clamp(y * 10000 + 101, y * 10000 + 1231);
  }
  if (dateRange === '30d') return trailing(30);
  return trailing(365);
}

export function histRangeWhere(range: HistRange, alias: string, column: string = 'DateKey'): string {
  return `AND ${alias}.${column} >= ${range.startKey} AND ${alias}.${column} <= ${range.endKey}`;
}

// Previous period for a KPI Δ%: mirrors buildPrevPeriodDateWhereClause in the
// main analytics (month: -> previous calendar month; otherwise the equal-length
// window immediately before), plus ytd:<past year> -> the whole prior year
// (legacy years are all closed). Null when it would start before the window.
export function previousRange(dateRange: string): HistRange | null {
  let prev: HistRange;
  const month = MONTH_RE.exec(dateRange);
  const ytd = YTD_RE.exec(dateRange);
  if (month) {
    const y = parseInt(month[1]);
    const m = parseInt(month[2]);
    if (m < 1 || m > 12) return null;
    const py = m === 1 ? y - 1 : y;
    const pm = m === 1 ? 12 : m - 1;
    prev = { startKey: py * 10000 + pm * 100 + 1, endKey: monthEndKey(py, pm) };
  } else if (ytd) {
    const y = parseInt(ytd[1]) - 1;
    prev = { startKey: y * 10000 + 101, endKey: y * 10000 + 1231 };
  } else {
    const r = resolveHistRange(dateRange);
    if (r.empty) return null;
    const days = Math.round((keyToDate(r.endKey).getTime() - keyToDate(r.startKey).getTime()) / DAY_MS) + 1;
    const endKey = addDays(r.startKey, -1);
    prev = { startKey: addDays(endKey, -(days - 1)), endKey };
  }
  return prev.startKey < HIST_START_KEY ? null : prev;
}

export type HistPreset = '30d' | 'month' | '12m' | 'last-year' | 'prev-year' | 'all';

function custom(startKey: number, endKey: number): string {
  return `custom:${keyToIso(startKey)}:${keyToIso(endKey)}`;
}

function monthValue(key: number): string {
  return `month:${keyToIso(key).slice(0, 7)}`;
}

const YEAR_OF = (key: number) => Math.floor(key / 10000);

// Calendar years that have data, newest first.
export function histYears(): number[] {
  const out: number[] = [];
  for (let y = YEAR_OF(HIST_END_KEY); y >= YEAR_OF(HIST_START_KEY); y--) out.push(y);
  return out;
}

// The last calendar year the data covers completely (the window end's year only when
// the data runs to Dec 31). A year-to-date range is never a useful default for closed
// legacy years, so "último año" means this full year.
export function histLastCompleteYear(): number {
  return HIST_END_KEY % 10000 === 1231 ? YEAR_OF(HIST_END_KEY) : YEAR_OF(HIST_END_KEY) - 1;
}

// A whole calendar year as a concrete URL value, clamped to the window (the last, partial
// year ends where the data ends).
export function histYearRange(year: number): string {
  const r = clamp(year * 10000 + 101, year * 10000 + 1231);
  return custom(r.startKey, r.endKey);
}

// The calendar year a range belongs to (a month, or any range inside a single year), null
// for ranges that span years or cannot be read; drives which year's months are listed.
export function histYearOfRange(dateRange: string): number | null {
  if (!CUSTOM_RE.test(dateRange) && !MONTH_RE.test(dateRange)) return null;
  const r = resolveHistRange(dateRange);
  if (r.empty) return null;
  return YEAR_OF(r.startKey) === YEAR_OF(r.endKey) ? YEAR_OF(r.startKey) : null;
}

export interface HistMonthChip { key: string; month: number; enabled: boolean }

// The 12 months of a year; the ones with no data in the window are disabled.
export function histMonthsOfYear(year: number): HistMonthChip[] {
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const key = `${year}-${String(month).padStart(2, '0')}`;
    return { key, month, enabled: !resolveHistRange(`month:${key}`).empty };
  });
}

// The Analítica presets, anchored to the end of the legacy data instead of
// today. Always returns a concrete custom: / month: value so the existing
// granularity helpers apply unchanged.
export function histPresetRange(preset: HistPreset): string {
  const end = HIST_END_KEY;
  switch (preset) {
    case '30d': return custom(addDays(end, -29), end);
    case 'month': return monthValue(end);
    case '12m': return custom(addDays(end, -364), end);
    case 'last-year': return histYearRange(histLastCompleteYear());
    case 'prev-year': return histYearRange(histLastCompleteYear() - 1);
    case 'all': return custom(HIST_START_KEY, end);
  }
}
