import { buildCsv } from '@/lib/csv';
import type { Plan } from './plan';
import type { MappingRow } from './types';

const COLUMNS = ['kind', 'key', 'from', 'to'].map((k, i) => ({
  key: k, label: k, defaultVisible: true, defaultOrder: i,
}));

export function diffCsv(plan: Plan): string {
  const rows: Record<string, unknown>[] = [
    ...plan.segmentsToCreate.map(s => ({ kind: 'crear_segmento', key: s.coSeg, from: '', to: s.segDes })),
    ...plan.zonesToCreate.map(z => ({ kind: 'crear_zona', key: z.coZon, from: '', to: z.zonDes })),
    ...plan.customerSegment.map(c => ({ kind: 'cliente_segmento', key: c.coCli, from: c.from ?? '', to: `${c.to} (${c.grupo})` })),
    ...plan.customerRoute.map(c => ({
      kind: 'cliente_ruta', key: c.coCli, from: `${c.fromZon}/${c.fromFrec ?? ''}`, to: `${c.toZon}/${c.toFrec}`,
    })),
    ...plan.customerSeller.map(c => ({ kind: 'cliente_vendedor', key: c.coCli, from: c.from, to: c.to })),
    ...plan.docSeller.map(d => ({ kind: `doc_${d.kind}`, key: `${d.docNum} (${d.coCli})`, from: d.from, to: d.to })),
    ...plan.problems.map(p => ({ kind: `PROBLEMA_${p.kind}`, key: p.coCli, from: '', to: p.detail })),
  ];
  return buildCsv(COLUMNS, rows);
}

/** Guard for destructive CLI modes: --confirm-db must equal the ERP DB_NAME exactly. */
export function assertConfirmedDb(confirm: string | undefined, dbName: string | undefined): void {
  if (!dbName) {
    throw new Error('DB_NAME no está definido; no se puede confirmar la base de datos destino');
  }
  if (confirm !== dbName) {
    throw new Error(`--confirm-db debe ser exactamente '${dbName}' (la base de datos ERP destino)`);
  }
}

/** Single effective-from date of the mapping; refuses empty or mixed-date CSVs. */
export function deriveSince(rows: MappingRow[]): string {
  if (rows.length === 0) throw new Error('El CSV no contiene filas de mapeo');
  const dates = [...new Set(rows.map(r => r.effectiveFrom))].sort();
  if (dates.length > 1) {
    throw new Error(`El CSV tiene más de una fecha effective_from (${dates.join(', ')}); debe haber exactamente una`);
  }
  return dates[0];
}
