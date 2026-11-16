// Product x customer-group share matrix (the workbook's "Hoja1"). Pure; the SQL lives in queries.ts.
export const NO_GROUP_CODE = '__sin_grupo__';
export const NO_GROUP_LABEL = 'Sin grupo';
const DEFAULT_MAX_ROWS = 30;

export interface GroupShareRaw { label: string; groupCode: string | null; groupName: string | null; salesBs: number; salesUsd: number | null; units: number }
export interface GroupShareColumn { code: string; name: string; salesBs: number; units: number }
export interface GroupShareCell { salesBs: number; salesUsd: number | null; share: number; units: number; unitShare: number }
export interface GroupShareRow { label: string; totalBs: number; totalUsd: number | null; totalUnits: number; cells: Record<string, GroupShareCell> }
export interface GroupShareMatrix { columns: GroupShareColumn[]; rows: GroupShareRow[] }

const addUsd = (acc: number | null, v: number | null): number | null => (v === null ? acc : (acc ?? 0) + v);

export function buildGroupShareMatrix(raw: readonly GroupShareRaw[], maxRows: number = DEFAULT_MAX_ROWS): GroupShareMatrix {
  interface Acc { label: string; totalBs: number; totalUsd: number | null; totalUnits: number; cells: Map<string, { bs: number; usd: number | null; units: number }> }
  const names = new Map<string, string>();
  const rowMap = new Map<string, Acc>();
  for (const r of raw) {
    if (!(r.salesBs > 0)) continue;
    const trimmed = r.groupCode?.trim();
    const code = trimmed ? trimmed : NO_GROUP_CODE;
    names.set(code, code === NO_GROUP_CODE ? NO_GROUP_LABEL : (r.groupName?.trim() || code));
    const row = rowMap.get(r.label) ?? { label: r.label, totalBs: 0, totalUsd: null, totalUnits: 0, cells: new Map() };
    row.totalBs += r.salesBs;
    row.totalUsd = addUsd(row.totalUsd, r.salesUsd);
    row.totalUnits += r.units;
    const cell = row.cells.get(code) ?? { bs: 0, usd: null, units: 0 };
    cell.units += r.units;
    cell.bs += r.salesBs;
    cell.usd = addUsd(cell.usd, r.salesUsd);
    row.cells.set(code, cell);
    rowMap.set(r.label, row);
  }

  const kept = [...rowMap.values()]
    .sort((a, b) => b.totalBs - a.totalBs || a.label.localeCompare(b.label))
    .slice(0, maxRows);

  const columnTotals = new Map<string, { bs: number; units: number }>();
  const rows: GroupShareRow[] = kept.map(row => {
    const cells: Record<string, GroupShareCell> = {};
    for (const [code, c] of row.cells) {
      cells[code] = { salesBs: c.bs, salesUsd: c.usd, share: c.bs / row.totalBs, units: c.units, unitShare: row.totalUnits > 0 ? c.units / row.totalUnits : 0 };
      const t = columnTotals.get(code) ?? { bs: 0, units: 0 };
      columnTotals.set(code, { bs: t.bs + c.bs, units: t.units + c.units });
    }
    return { label: row.label, totalBs: row.totalBs, totalUsd: row.totalUsd, totalUnits: row.totalUnits, cells };
  });

  const columns: GroupShareColumn[] = [...columnTotals]
    .map(([code, t]) => ({ code, name: names.get(code) ?? code, salesBs: t.bs, units: t.units }))
    .sort((a, b) =>
      (a.code === NO_GROUP_CODE ? 1 : 0) - (b.code === NO_GROUP_CODE ? 1 : 0)
      || b.salesBs - a.salesBs
      || a.name.localeCompare(b.name));
  return { columns, rows };
}
