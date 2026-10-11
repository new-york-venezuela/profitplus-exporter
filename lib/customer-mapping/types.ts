export type CustomerType = 'Cadena' | 'Independiente';

export interface MappingRow {
  coCli: string;
  nombre: string;
  coVen: string;            // '' = no seller known; seller and documents are left untouched
  grupo: string;
  tipoCliente: CustomerType;
  clientePrincipal: string;
  effectiveFrom: string;    // YYYY-MM-DD
  sourceNote: string;
}

export type ConflictKind = 'multi_seller' | 'duplicate_code' | 'missing_code' | 'no_invoices' | 'invalid_type';

export interface Conflict {
  coCli: string;
  nombre: string;
  kind: ConflictKind;
  detail: string;
}

export const MAPPING_COLUMNS = [
  'co_cli', 'nombre', 'co_ven', 'grupo', 'tipo_cliente', 'cliente_principal', 'effective_from', 'source_note',
] as const;
