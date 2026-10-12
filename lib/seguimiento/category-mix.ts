// Workbook "categoría" = Dim_Product.LineName, read dynamically (today Panaderia, Pasteleria, Pizza;
// Navidad appears by itself once it has sales). Fresco/Congelado (CategoryName) is NOT a level here.
export const OTHER_LINE_LABEL = 'Otros';
export const DEFAULT_MAX_VISIBLE_LINES = 6;

export interface Dual { bs: number; usd: number | null }
export interface LineAmount { line: string | null; sales: Dual }
export interface MixSegment { line: string; share: number; sales: Dual }

function realName(line: string | null): string | null {
  const n = line?.trim();
  return n ? n : null;
}

export function chooseVisibleLines(lines: readonly LineAmount[], max: number = DEFAULT_MAX_VISIBLE_LINES): string[] {
  const totals = new Map<string, number>();
  for (const l of lines) {
    const name = realName(l.line);
    if (!name || !(l.sales.bs > 0)) continue;
    totals.set(name, (totals.get(name) ?? 0) + l.sales.bs);
  }
  return [...totals]
    .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
    .slice(0, max)
    .map(([name]) => name);
}

function addInto(acc: { bs: number; usd: number | null }, d: Dual): void {
  acc.bs += d.bs;
  if (d.usd !== null) acc.usd = (acc.usd ?? 0) + d.usd;
}

export function bucketCategoryMix(lines: readonly LineAmount[], visible: readonly string[]): MixSegment[] {
  const visibleSet = new Set(visible);
  const byLine = new Map<string, { bs: number; usd: number | null }>();
  const other = { bs: 0, usd: null as number | null };
  let total = 0;
  for (const l of lines) {
    if (!(l.sales.bs > 0)) continue;
    total += l.sales.bs;
    const name = realName(l.line);
    if (name && visibleSet.has(name)) {
      const acc = byLine.get(name) ?? { bs: 0, usd: null };
      addInto(acc, l.sales);
      byLine.set(name, acc);
    } else {
      addInto(other, l.sales);
    }
  }
  if (total <= 0) return [];
  const segments: MixSegment[] = visible
    .filter(name => byLine.has(name))
    .map(name => ({ line: name, share: byLine.get(name)!.bs / total, sales: byLine.get(name)! }));
  if (other.bs > 0) segments.push({ line: OTHER_LINE_LABEL, share: other.bs / total, sales: other });
  return segments;
}
