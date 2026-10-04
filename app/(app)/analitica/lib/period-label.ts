import type { DateRange } from '../types';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function dmy(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Short human label for the selected dateRange, for KPI captions (e.g.
 * "Ventas brutas (jun 2026)"). Mirrors the formats buildDateWhereClause
 * accepts; anything unrecognized falls back to its trailing-365-day window.
 */
export function periodLabel(dateRange: DateRange): string {
  if (dateRange === '30d') return 'últimos 30 días';
  const month = /^month:(\d{4})-(\d{2})$/.exec(dateRange);
  if (month) return `${MONTHS[parseInt(month[2], 10) - 1] ?? month[2]} ${month[1]}`;
  const ytd = /^ytd:(\d{4})$/.exec(dateRange);
  if (ytd) return `${ytd[1]} a la fecha`;
  const custom = /^custom:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/.exec(dateRange);
  if (custom) return `${dmy(custom[1])}–${dmy(custom[2])}`;
  return 'últimos 12 meses';
}
