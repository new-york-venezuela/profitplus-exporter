import { eq } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import * as schema from '@/lib/db/schema';
import type { DocKind } from './erp';

export type RunStatus = 'pending' | 'applied' | 'failed' | 'rolled_back';

export interface RunSnapshot {
  customers: { coCli: string; coVen?: string; coSeg?: string }[];
  docs: { kind: DocKind; docNum: string; coVen: string }[];
}

export interface RunRecord {
  id: string;
  createdAt: number;
  mappingFile: string;
  status: RunStatus;
  snapshot: RunSnapshot;
}

export interface RunStore {
  create(r: RunRecord): void;
  get(id: string): RunRecord | undefined;
  setStatus(id: string, s: RunStatus): void;
}

export function sqliteRunStore(db: BunSQLiteDatabase<typeof schema>): RunStore {
  return {
    create(r) {
      db.insert(schema.mappingApplyRuns).values({
        id: r.id, createdAt: r.createdAt, mappingFile: r.mappingFile, status: r.status,
        snapshot: JSON.stringify(r.snapshot),
      }).run();
    },
    get(id) {
      const row = db.select().from(schema.mappingApplyRuns).where(eq(schema.mappingApplyRuns.id, id)).get();
      return row ? { ...row, snapshot: JSON.parse(row.snapshot) as RunSnapshot } : undefined;
    },
    setStatus(id, status) {
      db.update(schema.mappingApplyRuns).set({ status }).where(eq(schema.mappingApplyRuns.id, id)).run();
    },
  };
}
