import type { VisitFrequency } from './frequency';

export interface MappingRow {
  coCli: string;
  nombre: string;
  coVen: string;               // '' = no seller known; mapping:apply refuses it (missing_seller)
  grupo: string;
  ruta: number | null;         // route number 1..999; null = unknown, mapping:apply refuses it (missing_route)
  frecuencia: VisitFrequency;  // blank in the CSV means 'SEMANAL'
  effectiveFrom: string;       // YYYY-MM-DD
  sourceNote: string;
}

export type ConflictKind =
  | 'multi_seller' | 'duplicate_code' | 'missing_code' | 'no_invoices' | 'sales_code_not_in_master'
  | 'not_in_tracking' | 'route_code_not_in_master' | 'duplicate_tracking_row' | 'missing_route'
  | 'invalid_route' | 'invalid_frequency' | 'route_owner_tie' | 'route_without_owner'
  | 'seller_overridden_by_route_owner';

export interface Conflict {
  coCli: string;
  nombre: string;
  kind: ConflictKind;
  detail: string;
}

export const MAPPING_COLUMNS = [
  'co_cli', 'nombre', 'co_ven', 'grupo', 'ruta', 'frecuencia', 'effective_from', 'source_note',
] as const;
