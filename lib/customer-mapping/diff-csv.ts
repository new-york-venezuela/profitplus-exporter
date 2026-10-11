import { buildCsv } from '@/lib/csv';
import type { Plan } from './plan';

const COLUMNS = ['kind', 'key', 'from', 'to'].map((k, i) => ({
  key: k, label: k, defaultVisible: true, defaultOrder: i,
}));

export function diffCsv(plan: Plan): string {
  const rows: Record<string, unknown>[] = [
    ...plan.segmentsToCreate.map(s => ({ kind: 'crear_segmento', key: s.coSeg, from: '', to: s.segDes })),
    ...plan.customerSegment.map(c => ({ kind: 'cliente_segmento', key: c.coCli, from: c.from ?? '', to: `${c.to} (${c.grupo})` })),
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
