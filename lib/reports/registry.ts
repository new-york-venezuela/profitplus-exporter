export interface ColumnDef {
  key:            string;   // exact SQL column alias
  label:          string;   // Spanish display name shown in UI and CSV header
  defaultVisible: boolean;
  defaultOrder:   number;
  alwaysVisible?: boolean;  // if true, cannot be toggled off in the UI
  type?:          'text' | 'number' | 'date'; // cell typing hint for XLSX export; defaults to text
}

export interface SelectorOption {
  value: string;
  label: string;
}

export interface Selector {
  key:          string;
  label:        string;
  options:      SelectorOption[];
  defaultValue: string;
}

export interface ReportConfig {
  id:          string;                    // matches URL param: "ventas" | "compras"
  label:       string;                    // displayed in UI: "Libro de Ventas"
  queryType:   'view' | 'procedure' | 'query';
  sourceName?: string;                    // SQL view name or stored procedure name (omitted for 'query')
  snapshot?:   boolean;                   // point-in-time report: no date range
  dateColumn?: string;                    // required when queryType === 'view'
  selectors?:  Selector[];                // optional filters like sucursal
  columns:     ColumnDef[];
}

import { VENTAS_CONFIG }  from './ventas';
import { COMPRAS_CONFIG } from './compras';
import { RETENCIONES_CONFIG } from './retenciones';
import { CXC_PENDIENTES_CONFIG } from './cxc-pendientes';

export const REPORTS: Record<string, ReportConfig> = {
  ventas:  VENTAS_CONFIG,
  compras: COMPRAS_CONFIG,
  retenciones: RETENCIONES_CONFIG,
  'cxc-pendientes': CXC_PENDIENTES_CONFIG,
};
