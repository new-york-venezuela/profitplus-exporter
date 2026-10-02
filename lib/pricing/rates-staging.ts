import type { GridRow } from './client-types';
import { percentFromPrice } from './rates-math';

export type Staged = Record<string, number>;

export function stageEdit(staged: Staged, coArt: string, monto: number | null): Staged {
  const next = { ...staged };
  if (monto === null || !(monto > 0)) delete next[coArt];
  else next[coArt] = monto;
  return next;
}

export function pendingChanges(
  staged: Staged,
  rows: GridRow[],
): { coArt: string; artDes: string; before: number | null; after: number }[] {
  const out: { coArt: string; artDes: string; before: number | null; after: number }[] = [];
  for (const r of rows) {
    const after = staged[r.coArt];
    if (after === undefined || r.ambiguous) continue;
    const before = r.current?.monto ?? null;
    if (before !== null && before === after) continue;
    out.push({ coArt: r.coArt, artDes: r.artDes, before, after });
  }
  return out;
}

export function referenceFor(row: GridRow): number | null {
  return row.referenceMonto;
}

export function newDeltaPct(row: GridRow, staged: Staged): number | null {
  const price = staged[row.coArt];
  if (price === undefined) return null;
  return percentFromPrice(referenceFor(row), price);
}

export function visibleRows(
  rows: GridRow[],
  opts: { search: string; category: string; showUnpriced: boolean; staged: Staged },
): GridRow[] {
  const q = opts.search.trim().toLowerCase();
  return rows.filter(r => {
    if (opts.category && r.catDes !== opts.category) return false;
    if (q && !r.coArt.toLowerCase().includes(q) && !r.artDes.toLowerCase().includes(q)) return false;
    if (r.current === null && !r.ambiguous && opts.staged[r.coArt] === undefined && !opts.showUnpriced) return false;
    return true;
  });
}

export type BulkOp = { type: 'percent'; pct: number } | { type: 'set'; monto: number };

// Identity of an editable cell's local draft: any change in the staged price,
// reference, current rate or warehouse yields a new key, so a stale draft is
// discarded when state changes from outside (Descartar, bulk, list switch).
export function cellKey(row: GridRow, staged: Staged): string {
  return [row.coArt, row.coAlma ?? '', staged[row.coArt] ?? 'none', row.referenceMonto ?? 'none', row.current?.monto ?? 'none'].join(':');
}
