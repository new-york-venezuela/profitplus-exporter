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

const isUnpriced = (r: GridRow) => r.current === null && r.next === null && !r.ambiguous;

export function visibleRows(
  rows: GridRow[],
  opts: { search: string; category: string; showUnpriced: boolean; staged: Staged },
): GridRow[] {
  const q = opts.search.trim().toLowerCase();
  const shown = rows.filter(r => {
    if (opts.category && r.catDes !== opts.category) return false;
    if (q && !r.coArt.toLowerCase().includes(q) && !r.artDes.toLowerCase().includes(q)) return false;
    if (isUnpriced(r) && opts.staged[r.coArt] === undefined && !opts.showUnpriced) return false;
    return true;
  });
  // Articles being added (unpriced, price staged) sit on top so a new price is never lost in the list.
  const added = shown.filter(r => isUnpriced(r) && opts.staged[r.coArt] !== undefined);
  return added.length === 0 ? shown : [...added, ...shown.filter(r => !added.includes(r))];
}

/** Candidates for "Agregar artículos": unpriced, not yet staged, inside the retail scope unless widened. */
export function addableRows(
  rows: GridRow[],
  opts: { search: string; includeOutOfScope: boolean; staged: Staged },
): GridRow[] {
  const q = opts.search.trim().toLowerCase();
  return rows.filter(r => {
    if (!isUnpriced(r) || opts.staged[r.coArt] !== undefined) return false;
    if (!opts.includeOutOfScope && !r.inScope) return false;
    return !q || r.coArt.toLowerCase().includes(q) || r.artDes.toLowerCase().includes(q);
  });
}

export type BulkOp = { type: 'percent'; pct: number } | { type: 'set'; monto: number };

// Identity of a row's editable cells. Deliberately excludes the staged price so
// committing an edit never remounts the cells (focus is kept); discardNonce is
// bumped by the parent to force a remount of every cell.
export function rowIdentityKey(row: GridRow, discardNonce: number): string {
  return [row.coArt, row.coAlma ?? '', row.referenceMonto ?? 'none', discardNonce].join(':');
}

export interface CellDraft { text: string; base: number | null }

// A draft is shown only while the staged price is the one it was started against.
export function visibleDraft(draft: CellDraft | null, stagedPrice: number | undefined): string | null {
  if (draft === null) return null;
  return draft.base === (stagedPrice ?? null) ? draft.text : null;
}
