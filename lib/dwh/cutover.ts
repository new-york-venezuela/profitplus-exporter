// Profit Plus went live on 2026-03-28: 115 customers were loaded in one batch with the same
// saCliente.fecha_reg. Patrimonio / new customers are derived from that date, never stored.
// migrations/dwh/0040 repeats this literal; __tests__/unit/dwh/cutover.test.ts pins both.
export const MIGRATION_CUTOVER_DATE = '2026-03-28';

export type CustomerKind = 'patrimonio' | 'nuevo' | 'posterior';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function assertIso(d: string): void {
  if (!ISO.test(d)) throw new Error(`Fecha inválida '${d}'; se esperaba YYYY-MM-DD`);
}

export function isMigrationBatch(registeredDate: string): boolean {
  assertIso(registeredDate);
  return registeredDate === MIGRATION_CUTOVER_DATE;
}

// patrimonio in year Y: registered before Jan 1 of Y, or in the cutover batch.
// nuevo in year Y: registered in Y and not in the cutover batch.
export function customerKindInYear(registeredDate: string, year: number): CustomerKind {
  if (isMigrationBatch(registeredDate)) return 'patrimonio';
  const y = Number(registeredDate.slice(0, 4));
  if (y < year) return 'patrimonio';
  return y === year ? 'nuevo' : 'posterior';
}
