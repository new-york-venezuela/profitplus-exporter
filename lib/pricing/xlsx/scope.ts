import type { ConnectionPool } from 'mssql';
import type { ArticleRow } from '@/lib/pricing/rates-erp';

// DWH spelling (no accents). Congelado/Fresco is an attribute, not the filter.
export const SELLABLE_LINES = ['Panaderia', 'Pasteleria', 'Pizza'] as const;

export interface ScopedArticle { coArt: string; artDes: string; line: string; category: string }
export interface DwhProduct { productCode: string; lineName: string | null; categoryName: string | null }

const norm = (s: string) => s.trim().toUpperCase();

export function partitionByScope(
  erp: ArticleRow[],
  dwh: DwhProduct[],
): { inScope: ScopedArticle[]; unclassified: ArticleRow[] } {
  const byCode = new Map<string, DwhProduct>();
  for (const p of dwh) byCode.set(norm(p.productCode), p);
  const inScope: ScopedArticle[] = [];
  const unclassified: ArticleRow[] = [];
  for (const a of erp) {
    const p = byCode.get(norm(a.coArt));
    if (!p) { unclassified.push(a); continue; }
    if (p.lineName && (SELLABLE_LINES as readonly string[]).includes(p.lineName)) {
      inScope.push({ coArt: a.coArt.trim(), artDes: a.artDes, line: p.lineName, category: p.categoryName ?? '' });
    }
  }
  return { inScope, unclassified };
}

export async function fetchDwhProducts(pool: ConnectionPool): Promise<DwhProduct[]> {
  const r = await pool.request().query(
    'SELECT RTRIM(ProductCode) AS productCode, LineName AS lineName, CategoryName AS categoryName FROM dim.Dim_Product WHERE IsCurrent = 1',
  );
  return r.recordset as DwhProduct[];
}

export function scopeViolations(coArts: string[], inScope: ScopedArticle[], where: string): string[] {
  const ok = new Set(inScope.map((a) => norm(a.coArt)));
  return coArts
    .filter((c) => !ok.has(norm(c)))
    .map((c) => `${where}: ${c} no es un producto terminado (Panadería/Pastelería/Pizza)`);
}
