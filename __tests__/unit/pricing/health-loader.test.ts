import { describe, test, expect } from 'bun:test';
import { makeMemoryDb } from '../../helpers/memory-db';
import { loadHealthReport, type HealthErp } from '@/lib/pricing/health-loader';
import { insertItems, insertPromotion, updateItem } from '@/lib/pricing/promotions-repo';
import { upsertSegmentMeta } from '@/lib/pricing/segments-repo';
import { recordSweepRun } from '@/lib/pricing/health-repo';
import type { RateRow } from '@/lib/pricing/rate-planner';

const now = new Date(2026, 9, 1, 12);   // local 2026-10-01 noon
const today = '2026-10-01';

function fakeErp(seed: { lists?: string[]; rates?: RateRow[]; counts?: Record<string, number> } = {}) {
  const countCalls: string[][] = [];
  const erp: HealthErp = {
    listListsInUse: async () => seed.lists ?? [],
    readAllActiveRates: async codes => (seed.rates ?? []).filter(r => codes.includes(r.coPrecio)),
    countCustomersByTipCli: async codes => { countCalls.push(codes); return seed.counts ?? {}; },
  };
  return { erp, countCalls };
}

const promoRow = (name: string, startsOn: string, endsOn: string, cancelledAt: number | null = null) => ({
  name, reason: null, kind: 'overlay' as const, coPrecio: '08', baseCoPrecio: null, tipCli: null,
  startsOn, endsOn, cancelledAt, createdBy: 'u', createdAt: 1,
});
const special = (tipCli: string, expiresAt: string | null, kind: 'special' | 'group' = 'special') => ({
  tipCli, kind, customerCoCli: null, reason: `R${tipCli}`, expiresAt, fallbackTipCli: null, previousTipCli: null, createdBy: 'u', createdAt: 1,
});
const rate = (coArt: string, desde: string, hasta: string | null): RateRow =>
  ({ coArt, coPrecio: '08', coAlma: '000015', desde, hasta, monto: 1, coMone: 'USD', validador: '0x01' });

describe('loadHealthReport', () => {
  test('collects every section', async () => {
    const db = makeMemoryDb();
    insertPromotion(db, promoRow('Ends soon', '2026-09-20', '2026-10-04'));
    insertPromotion(db, promoRow('Cancelled', '2026-09-20', '2026-10-04', 1));
    upsertSegmentMeta(db, special('S1', '2026-09-25'));
    recordSweepRun(db, { runAt: now.getTime() - 3_600_000, ok: true, moved: 0, failed: 0 });
    const { erp } = fakeErp({ lists: ['08'], rates: [rate('A1', '2026-01-01', '2026-09-15')], counts: { S1: 2 } });
    const r = await loadHealthReport({ erp, db, now: () => now }, 7);
    expect(r.today).toBe(today);
    expect(r.endingSoon.map(i => i.name)).toEqual(['Ends soon']);
    expect(r.unreverted.map(i => [i.tipCli, i.customerCount])).toEqual([['S1', 2]]);
    expect(r.lapsed.map(i => i.coArt)).toEqual(['A1']);
    expect(r.stranded).toEqual([]);
    expect(r.sweep.state).toBe('ok');
  });

  test('empty data', async () => {
    const r = await loadHealthReport({ erp: fakeErp().erp, db: makeMemoryDb(), now: () => now }, 7);
    expect(r).toMatchObject({ endingSoon: [], unreverted: [], lapsed: [], stranded: [], sweep: { state: 'never' } });
  });

  test('counts customers only for expired special segments, and not at all when there are none', async () => {
    const db = makeMemoryDb();
    upsertSegmentMeta(db, special('OLD', '2026-09-01'));
    upsertSegmentMeta(db, special('FUTURE', '2026-12-01'));
    upsertSegmentMeta(db, special('GRP', null, 'group'));
    const a = fakeErp();
    await loadHealthReport({ erp: a.erp, db, now: () => now }, 7);
    expect(a.countCalls).toEqual([['OLD']]);
    const b = fakeErp();
    await loadHealthReport({ erp: b.erp, db: makeMemoryDb(), now: () => now }, 7);
    expect(b.countCalls).toEqual([]);
  });

  test('a swept (moved) ended promotion is not reported; a stranded one is', async () => {
    const db = makeMemoryDb();
    upsertSegmentMeta(db, special('S1', '2026-09-25'));
    const id = insertPromotion(db, promoRow('Ended', '2026-09-01', '2026-09-20'));
    insertItems(db, id, [{ coArt: 'A1', promoMonto: 1 }]);
    updateItem(db, id, 'A1', { appliedFrom: '2026-09-01', appliedTo: '2026-10-10' });
    const r = await loadHealthReport({ erp: fakeErp({ counts: {} }).erp, db, now: () => now }, 7);
    expect(r.unreverted).toEqual([]);
    expect(r.stranded.map(s => [s.promotionId, s.itemCount])).toEqual([[id, 1]]);
  });

  test('failed sweep run is reported', async () => {
    const db = makeMemoryDb();
    recordSweepRun(db, { runAt: now.getTime(), ok: false, moved: 0, failed: 0, error: 'boom' });
    const r = await loadHealthReport({ erp: fakeErp().erp, db, now: () => now }, 7);
    expect(r.sweep).toMatchObject({ state: 'failed', error: 'boom' });
  });
});
