// lib/pricing/list-export.ts
import { buildCsv } from '@/lib/csv';
import type { ColumnDef } from '@/lib/reports/registry';
import type { GridRow } from './lists-service';

const col = (key: string, label: string, i: number): ColumnDef => ({ key, label, defaultVisible: true, defaultOrder: i });
const COLUMNS: ColumnDef[] = [
  col('coArt', 'Código', 0), col('artDes', 'Artículo', 1), col('monto', 'Precio vigente', 2),
  col('desde', 'Vigente desde', 3), col('nextMonto', 'Próximo precio', 4), col('nextDesde', 'Próximo desde', 5),
];

export function buildListCsv(rows: GridRow[]): string {
  return buildCsv(COLUMNS, rows.map(r => ({
    coArt: r.coArt, artDes: r.artDes,
    monto: r.current?.monto ?? '', desde: r.current?.desde ?? '',
    nextMonto: r.next?.monto ?? '', nextDesde: r.next?.desde ?? '',
  })));
}
