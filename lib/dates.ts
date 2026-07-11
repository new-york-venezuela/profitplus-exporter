export interface DateRange {
  startDate: string;  // YYYY-MM-DD
  endDate:   string;  // YYYY-MM-DD
}

/**
 * Returns the first and last day of the month preceding `today`.
 * Default: uses the real current date.
 */
export function getPreviousMonthRange(today: Date = new Date()): DateRange {
  const year  = today.getFullYear();
  const month = today.getMonth(); // 0-indexed (0 = January)

  const prevYear  = month === 0 ? year - 1 : year;
  const prevMonth = month === 0 ? 12 : month; // 1-indexed

  const mm       = String(prevMonth).padStart(2, '0');
  const lastDay  = new Date(prevYear, prevMonth, 0).getDate(); // day-0 trick
  const dd       = String(lastDay).padStart(2, '0');

  return {
    startDate: `${prevYear}-${mm}-01`,
    endDate:   `${prevYear}-${mm}-${dd}`,
  };
}

/** Validates and returns a YYYY-MM-DD string, or null if invalid. */
export function parseDate(value: string | null): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}
