import { describe, test, expect } from 'bun:test';
import { endingSoon, unrevertedSegments, lapsedPrices, strandedPromotions, sweepStatus } from '@/lib/pricing/health';
import type { RateRow } from '@/lib/pricing/rate-planner';

const today = '2026-10-01';
const promo = (id: number, startsOn: string, endsOn: string, cancelledAt: number | null = null) =>
  ({ id, name: `P${id}`, kind: 'overlay' as const, coPrecio: '08', startsOn, endsOn, cancelledAt });

describe('endingSoon', () => {
  test('only active promotions inside the window, soonest first', () => {
    const out = endingSoon([
      promo(1, '2026-09-20', '2026-10-05'), promo(2, '2026-09-20', '2026-10-03'),
      promo(3, '2026-10-02', '2026-10-04'),                 // scheduled -> excluded
      promo(4, '2026-09-01', '2026-09-30'),                 // ended -> excluded
      promo(5, '2026-09-20', '2026-10-04', 1),              // cancelled -> excluded
      promo(6, '2026-09-20', '2026-12-01'),                 // beyond window
    ], today, 7);
    expect(out.map(i => [i.promotionId, i.daysLeft])).toEqual([[2, 2], [1, 4]]);
  });
  test('ends today counts (0 days)', () => {
    expect(endingSoon([promo(1, '2026-09-20', today)], today, 7)[0].daysLeft).toBe(0);
  });
});

describe('unrevertedSegments', () => {
  const meta = [
    { tipCli: 'A', kind: 'special' as const, reason: 'Promo A', expiresAt: '2026-09-25' },
    { tipCli: 'B', kind: 'special' as const, reason: null, expiresAt: '2026-09-30' },
    { tipCli: 'C', kind: 'special' as const, reason: 'No vence aún', expiresAt: '2026-10-01' },
    { tipCli: 'D', kind: 'group' as const, reason: null, expiresAt: null },
  ];
  test('expired specials that still have customers, most overdue first', () => {
    expect(unrevertedSegments(meta, { A: 2, B: 1, C: 5, D: 9 }, today).map(i => [i.tipCli, i.daysOverdue, i.customerCount, i.label]))
      .toEqual([['A', 6, 2, 'Promo A'], ['B', 1, 1, 'B']]);
  });
  test('expired segments with no customers are fine', () => {
    expect(unrevertedSegments(meta, { A: 0 }, today)).toEqual([]);
  });
});

describe('lapsedPrices', () => {
  const row = (coArt: string, coPrecio: string, desde: string, hasta: string | null): RateRow =>
    ({ coArt, coPrecio, coAlma: '000015', desde, hasta, monto: 1, coMone: 'USD', validador: '0x01' });
  test('flags articles whose rows exist but none covers today', () => {
    const out = lapsedPrices([
      row('A1', '08', '2026-01-01', '2026-09-15'),          // lapsed, no next
      row('A2', '08', '2026-01-01', '2026-09-15'), row('A2', '08', '2026-10-10', null),   // gap until a scheduled row
      row('A3', '08', '2026-01-01', null),                  // fine
      row('A4', '09', '2026-01-01', '2026-02-01'),          // list not in use -> ignored
    ], ['08'], today);
    expect(out.map(i => [i.coArt, i.lastHasta, i.nextDesde])).toEqual([['A1', '2026-09-15', null], ['A2', '2026-09-15', '2026-10-10']]);
  });
  test('a row ending today still covers today', () => {
    expect(lapsedPrices([row('A1', '08', '2026-01-01', today)], ['08'], today)).toEqual([]);
  });
});

describe('strandedPromotions', () => {
  const item = (appliedTo: string | null, cancelledOn: string | null = null) =>
    ({ appliedFrom: appliedTo ? '2026-09-01' : null, appliedTo, cancelledOn });
  test('ended/cancelled promotions with a promo row running past the end', () => {
    const out = strandedPromotions([
      promo(1, '2026-09-01', '2026-09-20'),                 // ended, stranded item
      promo(2, '2026-09-01', '2026-09-20'),                 // ended, row stopped on time
      promo(3, '2026-09-01', '2026-10-20'),                 // still active -> ignored
      promo(4, '2026-09-01', '2026-10-20', 5),              // cancelled, stranded
    ], {
      1: [item('2026-10-05'), item('2026-09-20')],
      2: [item('2026-09-20')],
      3: [item('2026-12-01')],
      4: [item('2026-11-01'), item('2026-11-01', '2026-09-30')],
    }, today);
    expect(out.map(i => [i.promotionId, i.itemCount])).toEqual([[1, 1], [4, 1]]);
  });
});

describe('sweepStatus', () => {
  const now = Date.UTC(2026, 9, 1, 12);
  const hoursAgo = (h: number) => now - h * 3_600_000;
  test('never', () => expect(sweepStatus(undefined, now).state).toBe('never'));
  test('ok within 36h', () => expect(sweepStatus({ runAt: hoursAgo(10), ok: true, failed: 0, error: null }, now)).toMatchObject({ state: 'ok', hoursSince: 10 }));
  test('stale after 36h', () => expect(sweepStatus({ runAt: hoursAgo(40), ok: true, failed: 0, error: null }, now).state).toBe('stale'));
  test('failed beats stale; failures count', () => {
    expect(sweepStatus({ runAt: hoursAgo(40), ok: true, failed: 2, error: null }, now).state).toBe('failed');
    expect(sweepStatus({ runAt: hoursAgo(1), ok: false, failed: 0, error: 'boom' }, now)).toMatchObject({ state: 'failed', error: 'boom' });
  });
});
