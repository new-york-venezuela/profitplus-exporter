import { addDays, daysBetween, parseIso } from './iso-date';
import { monthBounds } from './month-pace';

export interface IsoWeek { yearWeek: string; weekStart: string; weekEnd: string; label: string }

// Same definition as dim.Dim_Date.YearWeek (migrations/dwh/0033): Monday-first, the ISO year is
// the year of the week's Thursday, so 'YYYY-Www' strings match what the SQL side returns.
export function isoWeekOf(isoDate: string): IsoWeek {
  const weekday = parseIso(isoDate).getUTCDay() || 7; // Mon=1 .. Sun=7
  const weekStart = addDays(isoDate, 1 - weekday);
  const thursday = addDays(weekStart, 3);
  const isoYear = Number(thursday.slice(0, 4));
  const week = Math.floor(daysBetween(`${isoYear}-01-01`, thursday) / 7) + 1;
  return {
    yearWeek: `${isoYear}-W${String(week).padStart(2, '0')}`,
    weekStart,
    weekEnd: addDays(weekStart, 6),
    label: `S${week}`,
  };
}

export function isoWeeksOfMonth(month: string): IsoWeek[] {
  const { start, end } = monthBounds(month);
  const weeks: IsoWeek[] = [];
  for (let cursor = isoWeekOf(start).weekStart; cursor <= end; cursor = addDays(cursor, 7)) {
    weeks.push(isoWeekOf(cursor));
  }
  return weeks;
}
