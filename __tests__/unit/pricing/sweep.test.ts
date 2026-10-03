import { describe, expect, test } from 'bun:test';
import { makeMemoryDb } from '../../helpers/memory-db';
import { pickRevertTarget, runSweep, type SweepErp } from '@/lib/pricing/sweep';
import { upsertSegmentMeta, listAudit } from '@/lib/pricing/segments-repo';
import * as schema from '@/lib/db/schema';

const NOW = () => new Date(2026, 9, 10, 12, 0, 0); // 2026-10-10 local
const actor = { id: 'sweep', erpUser: 'PROFIT' };

function makeErp(segments: string[], customers: Record<string, string>, opts: { conflictFor?: string[] } = {}) {
  const segs = new Set(segments);
  const custs = { ...customers };
  const moves: string[] = [];
  const erp: SweepErp = {
    getSegment: async t => (segs.has(t) ? { tipCli: t } : null),
    listCustomersInSegment: async t =>
      Object.entries(custs).filter(([, tip]) => tip === t).map(([coCli]) => ({ coCli, cliDes: coCli })),
    moveCustomer: async (c, target) => {
      if (opts.conflictFor?.includes(c)) return { coCli: c, outcome: 'conflict' };
      const previousTipCli = custs[c];
      custs[c] = target;
      moves.push(c);
      return { coCli: c, outcome: 'success', previousTipCli };
    },
  };
  return { erp, custs, moves };
}

function seedMeta(db: ReturnType<typeof makeMemoryDb>, over: Partial<schema.NewSegmentMeta> = {}) {
  upsertSegmentMeta(db, {
    tipCli: 'SP01', kind: 'special', expiresAt: '2026-10-09', previousTipCli: 'G1', fallbackTipCli: 'G2',
    createdBy: 'u', createdAt: 1, ...over,
  });
}

function seedPromo(db: ReturnType<typeof makeMemoryDb>, tipCli: string, customers: Record<string, string>) {
  const p = db.insert(schema.pricingPromotions).values({
    kind: 'segment', name: 'P', coPrecio: 'L1', tipCli, startsOn: '2026-10-01', endsOn: '2026-10-09', createdBy: 'u', createdAt: 1,
  } as never).returning({ id: schema.pricingPromotions.id }).get();
  for (const [coCli, previousTipCli] of Object.entries(customers)) {
    db.insert(schema.pricingPromotionCustomers).values({ promotionId: p.id, coCli, previousTipCli } as never).run();
  }
}

describe('pickRevertTarget', () => {
  const all = () => true;
  test('prefers promotion previous, then meta previous, then fallback', () => {
    expect(pickRevertTarget({ promotionPrevious: 'A', metaPrevious: 'B', metaFallback: 'C' }, all, 'X')).toBe('A');
    expect(pickRevertTarget({ promotionPrevious: undefined, metaPrevious: 'B', metaFallback: 'C' }, all, 'X')).toBe('B');
    expect(pickRevertTarget({ promotionPrevious: undefined, metaPrevious: null, metaFallback: 'C' }, all, 'X')).toBe('C');
  });
  test('rejects non-existing candidates', () => {
    expect(pickRevertTarget({ promotionPrevious: 'A', metaPrevious: 'B', metaFallback: 'C' }, t => t === 'C', 'X')).toBe('C');
    expect(pickRevertTarget({ promotionPrevious: 'A', metaPrevious: 'B', metaFallback: null }, () => false, 'X')).toBeNull();
  });
  test('rejects the expired segment itself', () => {
    expect(pickRevertTarget({ promotionPrevious: 'X', metaPrevious: 'X', metaFallback: 'C' }, all, 'X')).toBe('C');
    expect(pickRevertTarget({ promotionPrevious: 'X', metaPrevious: null, metaFallback: null }, all, 'X')).toBeNull();
  });
});

describe('runSweep', () => {
  test('(a) reverts every customer to its promotion previous', async () => {
    const db = makeMemoryDb(); seedMeta(db);
    seedPromo(db, 'SP01', { c1: 'G1', c2: 'G2' });
    const { erp, custs } = makeErp(['SP01', 'G1', 'G2'], { c1: 'SP01', c2: 'SP01' });
    const s = await runSweep({ erp, db, now: NOW }, actor);
    expect(custs).toEqual({ c1: 'G1', c2: 'G2' });
    expect(s).toMatchObject({ segmentsChecked: 1, moved: 2, failed: 0 });
    const audit = listAudit(db).filter(a => a.action === 'sweep_revert');
    expect(audit).toHaveLength(2);
    expect(JSON.parse(audit[0].afterJson!)).toHaveProperty('tipCli');
    expect(JSON.parse(audit[0].beforeJson!)).toEqual({ tipCli: 'SP01' });
  });
  test('(b) one-customer special without promotion reverts to meta previous', async () => {
    const db = makeMemoryDb(); seedMeta(db);
    const { erp, custs } = makeErp(['SP01', 'G1', 'G2'], { c1: 'SP01' });
    await runSweep({ erp, db, now: NOW }, actor);
    expect(custs.c1).toBe('G1');
  });
  test('(c) missing previous falls back', async () => {
    const db = makeMemoryDb(); seedMeta(db);
    const { erp, custs } = makeErp(['SP01', 'G2'], { c1: 'SP01' });
    await runSweep({ erp, db, now: NOW }, actor);
    expect(custs.c1).toBe('G2');
  });
  test('(d) no valid target fails and leaves customer', async () => {
    const db = makeMemoryDb(); seedMeta(db);
    const { erp, custs } = makeErp(['SP01'], { c1: 'SP01' });
    const s = await runSweep({ erp, db, now: NOW }, actor);
    expect(custs.c1).toBe('SP01');
    expect(s.failed).toBe(1);
    expect(s.moved).toBe(0);
    expect(s.errors[0]).toContain('c1');
  });
  test('(e) hand-moved customer untouched', async () => {
    const db = makeMemoryDb(); seedMeta(db);
    const { erp, custs, moves } = makeErp(['SP01', 'G1', 'G2'], { c1: 'G2' });
    const s = await runSweep({ erp, db, now: NOW }, actor);
    expect(custs.c1).toBe('G2');
    expect(moves).toEqual([]);
    expect(s).toMatchObject({ segmentsChecked: 1, moved: 0, failed: 0 });
  });
  test('(f) second run is a no-op', async () => {
    const db = makeMemoryDb(); seedMeta(db);
    const { erp } = makeErp(['SP01', 'G1'], { c1: 'SP01' });
    expect((await runSweep({ erp, db, now: NOW }, actor)).moved).toBe(1);
    expect((await runSweep({ erp, db, now: NOW }, actor)).moved).toBe(0);
  });
  test('(g) segment expiring today is ignored; group kind ignored', async () => {
    const db = makeMemoryDb();
    seedMeta(db, { expiresAt: '2026-10-10' });
    seedMeta(db, { tipCli: 'GR', kind: 'group', expiresAt: '2026-10-01' });
    const { erp, moves } = makeErp(['SP01', 'GR', 'G1'], { c1: 'SP01', c2: 'GR' });
    const s = await runSweep({ erp, db, now: NOW }, actor);
    expect(moves).toEqual([]);
    expect(s.segmentsChecked).toBe(0);
  });
  test('(h) conflict counts failed, others continue', async () => {
    const db = makeMemoryDb(); seedMeta(db);
    const { erp, custs } = makeErp(['SP01', 'G1'], { c1: 'SP01', c2: 'SP01' }, { conflictFor: ['c1'] });
    const s = await runSweep({ erp, db, now: NOW }, actor);
    expect(s).toMatchObject({ moved: 1, failed: 1 });
    expect(custs).toEqual({ c1: 'SP01', c2: 'G1' });
    expect(listAudit(db).filter(a => a.action === 'sweep_revert')).toHaveLength(1);
  });
  test('thrown ERP error counts failed without leaking raw text', async () => {
    const db = makeMemoryDb(); seedMeta(db);
    const { erp } = makeErp(['SP01', 'G1'], { c1: 'SP01' });
    erp.moveCustomer = async () => { throw new Error('SELECT secret FROM x'); };
    const s = await runSweep({ erp, db, now: NOW }, actor);
    expect(s.failed).toBe(1);
    expect(s.errors.join(' ')).not.toContain('SELECT');
  });
});
