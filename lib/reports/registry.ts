export interface ColumnDef {
  key:            string;   // exact SQL column alias
  label:          string;   // Spanish display name shown in UI and CSV header
  defaultVisible: boolean;
  defaultOrder:   number;
  alwaysVisible?: boolean;  // if true, cannot be toggled off in the UI
}

export interface ReportConfig {
  id:          string;                    // matches URL param: "ventas" | "compras"
  label:       string;                    // displayed in UI: "Libro de Ventas"
  queryType:   'view' | 'procedure';
  sourceName:  string;                    // SQL view name or stored procedure name
  dateColumn?: string;                    // required when queryType === 'view'
  columns:     ColumnDef[];
}

import { VENTAS_CONFIG }  from './ventas';
import { COMPRAS_CONFIG } from './compras';

export const REPORTS: Record<string, ReportConfig> = {
  ventas:  VENTAS_CONFIG,
  compras: COMPRAS_CONFIG,
};
