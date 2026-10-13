import type { VisitFrequency } from './frequency';

export interface MappingRow {
  coCli: string;
  nombre: string;
  coVen: string;               // '' = leave the seller alone
  grupo: string;
  ruta: number | null;         // route number 1..999; null = leave the zone alone
  frecuencia: VisitFrequency;  // blank in the CSV means 'SEMANAL'
}

export const MAPPING_COLUMNS = ['co_cli', 'nombre', 'co_ven', 'grupo', 'ruta', 'frecuencia'] as const;

/** Customer sellers and document sellers are corrected from this date on (the system migration month). */
export const MAPPING_SINCE = '2026-03-01';
