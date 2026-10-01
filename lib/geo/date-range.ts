const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const RANGE_RE = /^(?:month:\d{4}-(?:0[1-9]|1[0-2])|ytd:\d{4}|custom:\d{4}-\d{2}-\d{2}:\d{4}-\d{2}-\d{2})$/;

const monthValue = (year: number, monthIndex: number) => `month:${year}-${String(monthIndex + 1).padStart(2, '0')}`;

export function isValidDateRange(value: string): boolean {
  return RANGE_RE.test(value);
}

export function previousMonthRange(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return monthValue(d.getFullYear(), d.getMonth());
}

export function periodOptions(now: Date = new Date()): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  for (let i = 0; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({ value: monthValue(d.getFullYear(), d.getMonth()), label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` });
  }
  options.push({ value: `ytd:${now.getFullYear()}`, label: `Año ${now.getFullYear()} (acumulado)` });
  return options;
}
