// Trend-chart bucket size. Pure (no server imports) so both the analytics
// client and the /api/dwh routes share one source of truth for which
// granularities a date range allows.

export type Granularity = 'day' | 'week' | 'month';

const CUSTOM_RANGE_RE = /^custom:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/;
const MONTH_RANGE_RE = /^month:(\d{4})-(\d{2})$/;
const YTD_RANGE_RE = /^ytd:(\d{4})$/;

const DAY_MS = 86_400_000;
const MAX_DAILY_SPAN = 31;
const MAX_WEEKLY_DEFAULT_SPAN = 92;
const MAX_WEEKLY_SPAN = 366;

function utcDay(y: number, m: number, d: number): number {
  return Date.UTC(y, m, d);
}

function parseIsoDay(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return utcDay(y, m - 1, d);
}

function formatIsoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function rangeSpanDays(dateRange: string, today: Date = new Date()): number {
  if (dateRange === '30d') return 30;

  const custom = CUSTOM_RANGE_RE.exec(dateRange);
  if (custom) {
    return Math.round((parseIsoDay(custom[2]) - parseIsoDay(custom[1])) / DAY_MS) + 1;
  }

  const month = MONTH_RANGE_RE.exec(dateRange);
  if (month) {
    const y = parseInt(month[1]);
    const m = parseInt(month[2]);
    return new Date(utcDay(y, m, 0)).getUTCDate();
  }

  const ytd = YTD_RANGE_RE.exec(dateRange);
  if (ytd) {
    const year = parseInt(ytd[1]);
    const start = utcDay(year, 0, 1);
    const end = year === today.getUTCFullYear()
      ? utcDay(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
      : utcDay(year, 11, 31);
    return Math.round((end - start) / DAY_MS) + 1;
  }

  return 365;
}

export function allowedGranularities(dateRange: string, today: Date = new Date()): Granularity[] {
  const span = rangeSpanDays(dateRange, today);
  if (span <= MAX_DAILY_SPAN) return ['day', 'week', 'month'];
  if (span <= MAX_WEEKLY_SPAN) return ['week', 'month'];
  return ['month'];
}

export function defaultGranularity(dateRange: string, today: Date = new Date()): Granularity {
  const span = rangeSpanDays(dateRange, today);
  if (span <= MAX_DAILY_SPAN) return 'day';
  if (span <= MAX_WEEKLY_DEFAULT_SPAN) return 'week';
  return 'month';
}

export function resolveGranularity(
  dateRange: string,
  requested: string | null | undefined,
  today: Date = new Date(),
): Granularity {
  const allowed = allowedGranularities(dateRange, today);
  return allowed.find(g => g === requested) ?? defaultGranularity(dateRange, today);
}

export interface WeekBucket {
  year: number;
  week: number;
  start: string; // YYYY-MM-DD, clipped to the year
  end: string;   // YYYY-MM-DD, clipped to the year
}

function firstMondayOnOrBefore(year: number): number {
  const jan1 = utcDay(year, 0, 1);
  const sinceMonday = (new Date(jan1).getUTCDay() + 6) % 7;
  return jan1 - sinceMonday * DAY_MS;
}

function weekBounds(year: number, week: number): { start: string; end: string } {
  const weekStart = firstMondayOnOrBefore(year) + (week - 1) * 7 * DAY_MS;
  const start = Math.max(weekStart, utcDay(year, 0, 1));
  const end = Math.min(weekStart + 6 * DAY_MS, utcDay(year, 11, 31));
  return { start: formatIsoDay(start), end: formatIsoDay(end) };
}

// Monday-first weeks; week 1 is the (possibly partial) week containing Jan 1.
// Weeks are split at the year boundary so the numbering resets each year and
// a bucket never spans two years. Mirrored in SQL by bucketKeyExpr('week').
export function weekOfYear(iso: string): WeekBucket {
  const day = parseIsoDay(iso);
  const year = new Date(day).getUTCFullYear();
  const week = Math.floor((day - firstMondayOnOrBefore(year)) / (7 * DAY_MS)) + 1;
  return { year, week, ...weekBounds(year, week) };
}

// 'range' = one aggregate bucket for the whole period; it is what "month"
// means inside a range of <= 31 days, so a 30d range crossing two calendar
// months is not split.
export type BucketMode = Granularity | 'range';

export function bucketMode(dateRange: string, granularity: Granularity, today: Date = new Date()): BucketMode {
  if (granularity === 'month' && rangeSpanDays(dateRange, today) <= MAX_DAILY_SPAN) return 'range';
  return granularity;
}

const MONTH_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DAY_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const WEEK_KEY_RE = /^(\d{4})-W(\d{2})$/;
const MONTH_KEY_RE = /^(\d{4})-(\d{2})$/;

export function bucketLabel(mode: BucketMode, key: string, opts: { multiYear?: boolean } = {}): string {
  switch (mode) {
    case 'day': {
      const m = DAY_KEY_RE.exec(key);
      return m ? `${parseInt(m[3])} ${MONTH_SHORT[parseInt(m[2]) - 1]}` : key;
    }
    case 'week': {
      const m = WEEK_KEY_RE.exec(key);
      if (!m) return key;
      const base = `S${parseInt(m[2])}`;
      return opts.multiYear ? `${base} '${m[1].slice(2)}` : base;
    }
    case 'month': {
      const m = MONTH_KEY_RE.exec(key);
      return m ? `${MONTH_SHORT[parseInt(m[2]) - 1]} ${m[1].slice(2)}` : key;
    }
    case 'range':
      return 'Total del período';
  }
}

// Inclusive date span a bucket covers, used to filter a drill-down. Null for
// 'range' (the page's own dateRange already scopes it) and for malformed keys.
export function bucketSpan(mode: BucketMode, key: string): { start: string; end: string } | null {
  switch (mode) {
    case 'day':
      return DAY_KEY_RE.test(key) ? { start: key, end: key } : null;
    case 'week': {
      const m = WEEK_KEY_RE.exec(key);
      if (!m) return null;
      const year = parseInt(m[1]);
      const week = parseInt(m[2]);
      const bounds = weekBounds(year, week);
      const maxWeek = weekOfYear(`${year}-12-31`).week;
      return week >= 1 && week <= maxWeek ? bounds : null;
    }
    case 'month': {
      const m = MONTH_KEY_RE.exec(key);
      if (!m) return null;
      const y = parseInt(m[1]);
      const mo = parseInt(m[2]);
      if (mo < 1 || mo > 12) return null;
      return { start: formatIsoDay(utcDay(y, mo - 1, 1)), end: formatIsoDay(utcDay(y, mo, 0)) };
    }
    case 'range':
      return null;
  }
}

export function bucketLabels(mode: BucketMode, keys: string[]): string[] {
  const multiYear = new Set(keys.map(k => k.slice(0, 4))).size > 1;
  return keys.map(k => bucketLabel(mode, k, { multiYear }));
}

const MONTH_LOWER = MONTH_SHORT.map(m => m.toLowerCase());

function dayParts(iso: string): { d: number; m: string; y: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { d, m: MONTH_LOWER[m - 1], y };
}

// Full, unambiguous label for tooltips: "Semana 2 · 5–11 ene 2026".
export function bucketTitle(mode: BucketMode, key: string): string {
  switch (mode) {
    case 'day': {
      if (!DAY_KEY_RE.test(key)) return key;
      const p = dayParts(key);
      return `${p.d} ${p.m} ${p.y}`;
    }
    case 'week': {
      const span = bucketSpan('week', key);
      if (!span) return key;
      const a = dayParts(span.start);
      const b = dayParts(span.end);
      const week = parseInt(key.slice(-2));
      const dates = a.m === b.m ? `${a.d}–${b.d} ${b.m} ${b.y}` : `${a.d} ${a.m}–${b.d} ${b.m} ${b.y}`;
      return `Semana ${week} · ${dates}`;
    }
    case 'month': {
      const m = MONTH_KEY_RE.exec(key);
      return m ? `${MONTH_LOWER[parseInt(m[2]) - 1]} ${m[1]}` : key;
    }
    case 'range':
      return 'Total del período';
  }
}

// Noun for chart subtitles: "Ventas netas por <unit>".
export const TREND_UNIT_LABEL: Record<BucketMode, string> = {
  day: 'día',
  week: 'semana',
  month: 'mes',
  range: 'período',
};
