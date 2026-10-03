import { describe, test, expect } from 'bun:test';
import { makeMemoryDb } from '../../helpers/memory-db';
import { runSweepJob } from '@/lib/pricing/sweep-job';
import { getLastSweepRun, saveAlertSettings } from '@/lib/pricing/health-repo';
import { insertPromotion } from '@/lib/pricing/promotions-repo';
import type { HealthErp } from '@/lib/pricing/health-loader';
import type { SweepErp } from '@/lib/pricing/sweep';
import { upsertSegmentMeta } from '@/lib/pricing/segments-repo';

const NOW = () => new Date(2026, 9, 1, 12);
const actor = { id: 'sweep', erpUser: 'PROFIT' };
const healthErp: HealthErp = { listListsInUse: async () => [], readAllActiveRates: async () => [], countCustomersByTipCli: async () => ({}) };
const okErp: SweepErp = { getSegment: async () => null, listCustomersInSegment: async () => [], moveCustomer: async c => ({ coCli: c, outcome: 'success' }) as never };
const noMail = { send: async () => { throw new Error('must not send'); } };

describe('runSweepJob', () => {
  test('clean run with nothing to report: heartbeat ok, nothing sent, exit 0', async () => {
    const db = makeMemoryDb();
    // a recent ok heartbeat is written by the job itself, so sweep state is ok
    const r = await runSweepJob({ sweep: { erp: okErp, db }, healthErp, db, email: noMail, now: NOW }, actor);
    expect(r.exitCode).toBe(0);
    expect(r.digest?.skipped).toBe('empty');
    const last = getLastSweepRun(db)!;
    expect(last.ok).toBe(1);
    expect(last.failed).toBe(0);
  });

  test('sweep throws: heartbeat written as failed with the error, digest still attempted, exit 1', async () => {
    const db = makeMemoryDb();
    saveAlertSettings(db, { enabled: true, daysAhead: 7, recipients: ['a@x.com'] });
    upsertSegmentMeta(db, {
      tipCli: 'SP01', kind: 'special', expiresAt: '2026-09-30', previousTipCli: 'G1', fallbackTipCli: 'G2', createdBy: 'u', createdAt: 1,
    });
    // runSweep contains per-customer ERP errors itself; a throw only comes from its own setup (here: the segment meta read).
    const brokenDb = new Proxy(db, { get: (t, k, rcv) => (k === 'select' ? () => { throw new Error('erp down'); } : Reflect.get(t, k, rcv)) });
    const sent: string[] = [];
    const r = await runSweepJob({
      sweep: { erp: okErp, db: brokenDb }, healthErp, db, email: { send: async to => { sent.push(to); } }, now: NOW,
    }, actor);
    expect(r.sweepError).toBe('erp down');
    expect(r.exitCode).toBe(1);
    const last = getLastSweepRun(db)!;
    expect(last.ok).toBe(0);
    expect(last.error).toBe('erp down');
    expect(sent).toEqual(['a@x.com']);   // the failed heartbeat is itself reportable
  });

  test('send failure sets exit 1 but heartbeat exists and other recipients are served', async () => {
    const db = makeMemoryDb();
    saveAlertSettings(db, { enabled: true, daysAhead: 7, recipients: ['a@x.com', 'b@x.com'] });
    insertPromotion(db, {
      name: 'P', reason: null, kind: 'overlay', coPrecio: '08', baseCoPrecio: null, tipCli: null,
      startsOn: '2026-09-01', endsOn: '2026-10-03', cancelledAt: null, createdBy: 'u', createdAt: 1,
    });
    const sent: string[] = [];
    const r = await runSweepJob({
      sweep: { erp: okErp, db }, healthErp, db, now: NOW,
      email: { send: async to => { sent.push(to); if (to === 'a@x.com') throw new Error('smtp'); } },
    }, actor);
    expect(sent).toEqual(['a@x.com', 'b@x.com']);
    expect(r.digest).toEqual({ sent: 1, failed: 1, skipped: null });
    expect(r.exitCode).toBe(1);
    expect(getLastSweepRun(db)).toBeDefined();
  });

  test('summary.failed is recorded in the heartbeat', async () => {
    const db = makeMemoryDb();
    upsertSegmentMeta(db, {
      tipCli: 'SP01', kind: 'special', expiresAt: '2026-09-30', previousTipCli: 'G1', fallbackTipCli: 'G2', createdBy: 'u', createdAt: 1,
    });
    const erp: SweepErp = {
      getSegment: async t => ({ tipCli: t }),
      listCustomersInSegment: async () => [{ coCli: 'C1', cliDes: 'C1' }],
      moveCustomer: async c => ({ coCli: c, outcome: 'conflict' }) as never,
    };
    const r = await runSweepJob({ sweep: { erp, db }, healthErp, db, email: { send: async () => {} }, now: NOW }, actor);
    expect(r.summary!.failed).toBeGreaterThan(0);
    expect(getLastSweepRun(db)!.failed).toBe(r.summary!.failed);
    expect(r.exitCode).toBe(1);
  });
});
