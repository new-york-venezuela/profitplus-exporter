import type { ColumnDef } from '@/lib/reports/registry';

// Raw shape of one grouped row from the export's SALES query (grouped by
// SalesRepKey, ProductKey, CustomerKey, WeekStartDate -- see route.ts's
// exportSalesQuery). IngresoBs/IngresoUsd come from dualAmountExpr
// aliased to these names.
export interface MatrizExportSalesRow {
  SalesRepName: string;
  LegalEntityName: string;
  CustomerName: string;
  ProductName: string;
  LineName: string | null;
  SubLineName: string | null;
  CategoryName: string | null;
  WeekStartDate: string; // 'YYYY-MM-DD'
  YearMonth: string;
  IngresoBs: number;
  IngresoUsd: number | null;
  Unidades: number;
}

// Same grain (SalesRepKey, ProductKey, CustomerKey, WeekStartDate, YearMonth),
// from the export's RETURNS query -- keyed for the join in
// buildMatrizExportRows by (SalesRepName, ProductName, CustomerName,
// LegalEntityName, WeekStartDate, YearMonth) via a composite string key,
// since these are already the resolved display names by the time they reach
// this pure function (the join key doesn't need the underlying surrogate
// keys -- see route.ts: both export queries group by the resolved display
// names, not the surrogate keys, matching how the rest of this route's
// non-export sections also resolve names before mapping into response rows).
export interface MatrizExportReturnsRow {
  SalesRepName: string;
  LegalEntityName: string;
  CustomerName: string;
  ProductName: string;
  LineName: string | null;
  SubLineName: string | null;
  CategoryName: string | null;
  WeekStartDate: string;
  YearMonth: string;
  DevolucionBs: number;
  DevolucionUsd: number | null;
  DevolucionUnidades: number;
}

export const MATRIZ_EXPORT_COLUMNS: ColumnDef[] = [
  { key: 'Vendedor', label: 'Vendedor', defaultVisible: true, defaultOrder: 0, alwaysVisible: true },
  { key: 'Entidad', label: 'Entidad', defaultVisible: true, defaultOrder: 1, alwaysVisible: true },
  { key: 'Tienda', label: 'Tienda', defaultVisible: true, defaultOrder: 2, alwaysVisible: true },
  { key: 'Producto', label: 'Producto', defaultVisible: true, defaultOrder: 3, alwaysVisible: true },
  { key: 'Línea', label: 'Línea', defaultVisible: true, defaultOrder: 4 },
  { key: 'Sublínea', label: 'Sublínea', defaultVisible: true, defaultOrder: 5 },
  { key: 'Categoría', label: 'Categoría', defaultVisible: true, defaultOrder: 6 },
  { key: 'Semana', label: 'Semana', defaultVisible: true, defaultOrder: 7, type: 'date' },
  { key: 'Mes', label: 'Mes', defaultVisible: true, defaultOrder: 8 },
  { key: 'Ingreso USD', label: 'Ingreso USD', defaultVisible: true, defaultOrder: 9, type: 'number' },
  { key: 'Unidades', label: 'Unidades', defaultVisible: true, defaultOrder: 10, type: 'number' },
  { key: 'Devolución USD', label: 'Devolución USD', defaultVisible: true, defaultOrder: 11, type: 'number' },
  { key: 'Devolución Unidades', label: 'Devolución Unidades', defaultVisible: true, defaultOrder: 12, type: 'number' },
  { key: 'Tasa Devolución USD', label: 'Tasa Devolución USD', defaultVisible: true, defaultOrder: 13, type: 'number' },
  { key: 'Tasa Devolución Unidades', label: 'Tasa Devolución Unidades', defaultVisible: true, defaultOrder: 14, type: 'number' },
];

function key(
  salesRepName: string, productName: string, customerName: string, legalEntityName: string,
  weekStartDate: string, yearMonth: string,
): string {
  return `${salesRepName}|${productName}|${customerName}|${legalEntityName}|${weekStartDate}|${yearMonth}`;
}

// Pure row-shaping: join sales+returns at (seller, product, store, week,
// month) grain and compute per-row return rates -- kept separate from
// route.ts's SQL/HTTP glue so it's unit-testable without a live DWH
// connection (this repo's route tests are auth-smoke-only, see this plan's
// Global Constraints). Per-row rates (not a separate returns sheet) so the
// user's own Excel pivot tables can re-roll-up the ratio at any grain
// without a manual join -- confirmed with user during brainstorming.
//
// Output includes one row per combination with non-zero sales OR returns:
// sales-driven rows first (possibly joined with a matching returns row),
// then any returns-only combination that had no matching sales row at all
// (Ingreso USD/Unidades: 0, real returns amounts, null rates since a
// rate-over-zero-sales is undefined).
export function buildMatrizExportRows(
  salesRows: MatrizExportSalesRow[],
  returnsRows: MatrizExportReturnsRow[],
): Record<string, unknown>[] {
  const returnsByKey = new Map<string, MatrizExportReturnsRow>();
  for (const r of returnsRows) {
    returnsByKey.set(key(r.SalesRepName, r.ProductName, r.CustomerName, r.LegalEntityName, r.WeekStartDate, r.YearMonth), r);
  }

  const consumedKeys = new Set<string>();

  const salesDrivenRows = salesRows.map(s => {
    const k = key(s.SalesRepName, s.ProductName, s.CustomerName, s.LegalEntityName, s.WeekStartDate, s.YearMonth);
    const returns = returnsByKey.get(k);
    if (returns) consumedKeys.add(k);
    const devolucionUsd = returns?.DevolucionUsd ?? 0;
    const devolucionUnidades = returns?.DevolucionUnidades ?? 0;
    const ingresoUsd = s.IngresoUsd ?? 0;

    return {
      Vendedor: s.SalesRepName,
      Entidad: s.LegalEntityName,
      Tienda: s.CustomerName,
      Producto: s.ProductName,
      Línea: s.LineName ?? '',
      Sublínea: s.SubLineName ?? '',
      Categoría: s.CategoryName ?? '',
      Semana: s.WeekStartDate,
      Mes: s.YearMonth,
      'Ingreso USD': ingresoUsd,
      Unidades: s.Unidades,
      'Devolución USD': devolucionUsd,
      'Devolución Unidades': devolucionUnidades,
      'Tasa Devolución USD': returns && ingresoUsd > 0 ? devolucionUsd / ingresoUsd : null,
      'Tasa Devolución Unidades': returns && s.Unidades > 0 ? devolucionUnidades / s.Unidades : null,
    };
  });

  const returnsOnlyRows = returnsRows
    .filter(r => !consumedKeys.has(key(r.SalesRepName, r.ProductName, r.CustomerName, r.LegalEntityName, r.WeekStartDate, r.YearMonth)))
    .map(r => ({
      Vendedor: r.SalesRepName,
      Entidad: r.LegalEntityName,
      Tienda: r.CustomerName,
      Producto: r.ProductName,
      Línea: r.LineName ?? '',
      Sublínea: r.SubLineName ?? '',
      Categoría: r.CategoryName ?? '',
      Semana: r.WeekStartDate,
      Mes: r.YearMonth,
      'Ingreso USD': 0,
      Unidades: 0,
      'Devolución USD': r.DevolucionUsd ?? 0,
      'Devolución Unidades': r.DevolucionUnidades,
      'Tasa Devolución USD': null,
      'Tasa Devolución Unidades': null,
    }));

  return [...salesDrivenRows, ...returnsOnlyRows];
}
