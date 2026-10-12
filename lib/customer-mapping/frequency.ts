// ERP storage: saCliente.frecu_vist (varchar(60), free in the ERP) holds one of these values.
// The same list is enforced by pApiActualizarRutaCliente (migrations/mssql/0018) and mirrored in
// dwh.Load_Dim_Customer (migrations/dwh/0040); tests pin the three copies together.
export const VISIT_FREQUENCIES = ['SEMANAL', 'QUINCENAL', 'MENSUAL'] as const;
export type VisitFrequency = (typeof VISIT_FREQUENCIES)[number];

export const DEFAULT_VISIT_FREQUENCY: VisitFrequency = 'SEMANAL';

export const VISIT_INTERVAL_DAYS: Record<VisitFrequency, number> = { SEMANAL: 7, QUINCENAL: 15, MENSUAL: 30 };

// Accents are NOT stripped: SQL Server (Modern_Spanish_CI_AS) compares them, and the DWH loader must agree.
export function parseVisitFrequency(raw: unknown): VisitFrequency | null {
  if (typeof raw !== 'string') return null;
  const key = raw.trim().toUpperCase();
  return (VISIT_FREQUENCIES as readonly string[]).includes(key) ? (key as VisitFrequency) : null;
}

export function visitIntervalDays(f: VisitFrequency | null | undefined): number | null {
  return f ? VISIT_INTERVAL_DAYS[f] : null;
}
