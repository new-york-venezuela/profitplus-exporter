// __tests__/unit/pricing/promotions-service.test.ts
import { sql } from 'drizzle-orm';
import { describe, test, expect, beforeEach } from 'bun:test';
import { makeMemoryDb } from '../../helpers/memory-db';
import { makeFakeRatesErp, type FakeRatesState } from '../../helpers/fake-rates-erp';
import { makeFakeSegmentErp, type FakeSegmentState } from '../../helpers/fake-segment-erp';
import {
  createPromotion, getPromotionDetail, listPromotionDtos, patchPromotion, previewPromotion, retryPromotion,
  type PromotionsDeps,
} from '@/lib/pricing/promotions-service';
import { listAudit, getSegmentMeta, upsertSegmentMeta } from '@/lib/pricing/segments-repo';
import { listCustomers, listItems } from '@/lib/pricing/promotions-repo';
import { NotFoundError, ValidationError } from '@/lib/pricing/segments-service';
import type { CreatePromotionInput } from '@/lib/pricing/promo-validators';
import type { RateRow } from '@/lib/pricing/rate-planner';
import { addDaysIso } from '@/lib/pricing/dates';

const actor = { id: '7', erpUser: 'PROFIT' };
const at = (y: number, m: number, d: number) => () => new Date(y, m - 1, d);
let deps: PromotionsDeps;
let rates: FakeRatesState;
let seg: FakeSegmentState;

const row = (coArt: string, desde: string, hasta: string | null, monto: number, coPrecio = '08'): RateRow =>
  ({ coArt, coPrecio, coAlma: '000015', desde, hasta, monto, coMone: 'USD', validador: '0x01' });
const rowsOf = (coArt: string, coPrecio = '08') =>
  rates.rates.filter(r => r.coArt === coArt && r.coPrecio === coPrecio).sort((a, b) => a.desde.localeCompare(b.desde));

/** Rows form one contiguous timeline: each starts the day after the previous ends; the last is open-ended. */
function assertNoGaps(rows: RateRow[]) {
  const s = [...rows].sort((a, b) => a.desde.localeCompare(b.desde));
  expect(s.length).toBeGreaterThan(0);
  for (let i = 0; i < s.length - 1; i++) {
    expect(s[i].hasta).not.toBeNull();
    expect(s[i + 1].desde).toBe(addDaysIso(s[i].hasta!, 1));
  }
  expect(s[s.length - 1].hasta).toBeNull();
}

const overlay = (items: { coArt: string; monto: number }[], over: Partial<CreatePromotionInput> = {}): CreatePromotionInput => ({
  kind: 'overlay', name: 'Oferta Octubre', reason: null, coPrecio: '08', startsOn: '2026-10-05', endsOn: '2026-10-15', items, ...over,
} as CreatePromotionInput);
const segmentInput = (): CreatePromotionInput => ({
  kind: 'segment', name: 'Oferta Octubre', reason: 'Clientes VIP', baseCoPrecio: '08', customerCodes: ['C1', 'C2'],
  startsOn: '2026-10-05', endsOn: '2026-10-15', items: [{ coArt: 'A1', monto: 8 }, { coArt: 'A2', monto: 15 }],
});

beforeEach(() => {
  const r = makeFakeRatesErp({
    lists: [{ coPrecio: '08', desPrecio: 'INDEPENDIENTES' }],
    articles: [{ coArt: 'A1', artDes: 'Harina 1kg' }, { coArt: 'A2', artDes: 'Aceite 1L' }, { coArt: 'A3', artDes: 'Sal' }],
    rates: [row('A1', '2026-03-15', null, 10), row('A2', '2026-03-15', null, 20)],
  });
  const s = makeFakeSegmentErp({
    segments: [{ tipCli: '000001', desTipo: 'GENERAL', coPrecio: '08', desPrecio: null, customerCount: 0, validador: '0x1' }],
    customers: { C1: { cliDes: 'Cliente Uno', tipCli: '000001' }, C2: { cliDes: 'Cliente Dos', tipCli: '000001' } },
  });
  rates = r.state;
  seg = s.state;
  deps = { rates: r.erp, segments: s.erp, db: makeMemoryDb(), now: at(2026, 10, 1) };
});

describe('overlay promotions', () => {
  test('create splits the regular rate, captures regularMonto, audits', async () => {
    const d = await createPromotion(deps, overlay([{ coArt: 'A1', monto: 8 }, { coArt: 'A2', monto: 15 }]), actor);
    expect(rowsOf('A1').map(r => [r.desde, r.hasta, r.monto])).toEqual([
      ['2026-03-15', '2026-10-04', 10], ['2026-10-05', '2026-10-15', 8], ['2026-10-16', null, 10],
    ]);
    expect(d.items.map(i => [i.coArt, i.applied, i.regularMonto, i.promoMonto, i.artDes])).toEqual([
      ['A1', true, 10, 8, 'Harina 1kg'], ['A2', true, 20, 15, 'Aceite 1L'],
    ]);
    expect(d).toMatchObject({ status: 'scheduled', partial: false, appliedCount: 2, itemCount: 2, daysLeft: 14, kind: 'overlay', desPrecio: 'INDEPENDIENTES' });
    expect(listItems(deps.db, d.id)[0].coAlma).toBe('000015');
    const a = listAudit(deps.db).find(x => x.action === 'promotion_create')!;
    expect(a.target).toBe(String(d.id));
    expect((await listPromotionDtos(deps)).map(p => p.id)).toEqual([d.id]);
  });

  test('unknown list -> NotFoundError and nothing is created', async () => {
    await expect(createPromotion(deps, overlay([{ coArt: 'A1', monto: 8 }], { coPrecio: 'ZZ' } as never), actor)).rejects.toBeInstanceOf(NotFoundError);
    expect(await listPromotionDtos(deps)).toEqual([]);
  });

  test('partial: article without regular rate stays unapplied; retry applies only that one and is idempotent', async () => {
    const d = await createPromotion(deps, overlay([{ coArt: 'A1', monto: 8 }, { coArt: 'A3', monto: 3 }]), actor);
    const a3 = d.items.find(i => i.coArt === 'A3')!;
    expect(a3.applied).toBe(false);
    expect(a3.message).toBe('No hay una tarifa regular vigente para esa fecha');
    expect(d.items.find(i => i.coArt === 'A1')!.applied).toBe(true);
    expect(d.partial).toBe(true);

    rates.rates.push(row('A3', '2026-03-15', null, 5));
    const r1 = await retryPromotion(deps, d.id, actor);
    expect(r1.partial).toBe(false);
    expect(r1.items.find(i => i.coArt === 'A3')).toMatchObject({ applied: true, regularMonto: 5, message: null });
    const snapshot = JSON.stringify(rates.rates);
    const r2 = await retryPromotion(deps, d.id, actor);
    expect(r2.partial).toBe(false);
    expect(JSON.stringify(rates.rates)).toBe(snapshot);
  });

  test('scheduled change inside the window rejects only that article', async () => {
    rates.rates = rates.rates.filter(r => r.coArt !== 'A2');
    rates.rates.push(row('A2', '2026-03-15', '2026-10-09', 20), row('A2', '2026-10-10', null, 22));
    const d = await createPromotion(deps, overlay([{ coArt: 'A1', monto: 8 }, { coArt: 'A2', monto: 15 }]), actor);
    expect(d.items.map(i => [i.coArt, i.applied])).toEqual([['A1', true], ['A2', false]]);
    expect(d.items[1].message).toBe('Hay un cambio programado dentro del período');
  });

  test('mixed currency on the covering row is rejected for that article', async () => {
    rates.rates.find(r => r.coArt === 'A2')!.coMone = 'BSD';
    const d = await createPromotion(deps, overlay([{ coArt: 'A1', monto: 8 }, { coArt: 'A2', monto: 15 }]), actor);
    expect(d.items.find(i => i.coArt === 'A2')).toMatchObject({ applied: false, message: 'El artículo tiene una moneda distinta a la de la lista' });
    expect(rowsOf('A2').length).toBe(1);
  });

  test('thrown ERP errors never leak raw text into the item message', async () => {
    const original = deps.rates.applyPlanned;
    deps.rates.applyPlanned = async () => { throw new Error('SELECT secret FROM saArtPrecio failed'); };
    const d = await createPromotion(deps, overlay([{ coArt: 'A1', monto: 8 }]), actor);
    deps.rates.applyPlanned = original;
    expect(d.items[0].applied).toBe(false);
    expect(d.items[0].message).not.toContain('secret');
    expect(d.items[0].message).toBeTruthy();
  });

  test('same-day regular row uses the in-place branch (no duplicate desde)', async () => {
    rates.rates = rates.rates.filter(r => r.coArt !== 'A1');
    rates.rates.push(row('A1', '2026-03-15', '2026-09-30', 9), row('A1', '2026-10-01', null, 10));
    await createPromotion(deps, overlay([{ coArt: 'A1', monto: 8 }], { startsOn: '2026-10-01', endsOn: '2026-10-10' } as never), actor);
    const rs = rowsOf('A1');
    expect(rs.map(r => [r.desde, r.hasta, r.monto])).toEqual([
      ['2026-03-15', '2026-09-30', 9], ['2026-10-01', '2026-10-10', 8], ['2026-10-11', null, 10],
    ]);
    expect(new Set(rs.map(r => r.desde)).size).toBe(rs.length);
  });

  test('cancel before start restores the regular price with no gaps', async () => {
    const d = await createPromotion(deps, overlay([{ coArt: 'A1', monto: 8 }, { coArt: 'A2', monto: 15 }]), actor);
    const c = await patchPromotion(deps, d.id, { action: 'cancel' }, actor);
    expect(c.status).toBe('cancelled');
    for (const art of ['A1', 'A2']) {
      const rs = rowsOf(art);
      assertNoGaps(rs);
      expect(rs[0].desde).toBe('2026-03-15');
      expect(new Set(rs.map(r => r.monto)).size).toBe(1);
    }
    expect(listAudit(deps.db).some(x => x.action === 'promotion_cancel')).toBe(true);
    // retrying the cancel of a cancelled promotion is invalid
    await expect(patchPromotion(deps, d.id, { action: 'cancel' }, actor)).rejects.toBeInstanceOf(ValidationError);
  });

  test('cancel while active keeps elapsed days at the promo price, remainder at regular, no gaps', async () => {
    const d = await createPromotion(deps, overlay([{ coArt: 'A1', monto: 8 }]), actor);
    deps.now = at(2026, 10, 9);
    const c = await patchPromotion(deps, d.id, { action: 'cancel' }, actor);
    expect(c.status).toBe('cancelled');
    const rs = rowsOf('A1');
    assertNoGaps(rs);
    expect(rs.map(r => [r.desde, r.hasta, r.monto])).toEqual([
      ['2026-03-15', '2026-10-04', 10], ['2026-10-05', '2026-10-08', 8], ['2026-10-09', '2026-10-15', 10], ['2026-10-16', null, 10],
    ]);
  });

  test('cancel on an ended promotion -> ValidationError', async () => {
    const d = await createPromotion(deps, overlay([{ coArt: 'A1', monto: 8 }]), actor);
    deps.now = at(2026, 10, 20);
    await expect(patchPromotion(deps, d.id, { action: 'cancel' }, actor)).rejects.toBeInstanceOf(ValidationError);
  });

  test('cancel is retry-safe when an ERP step fails: not cancelled, then completes without duplicates', async () => {
    const d = await createPromotion(deps, overlay([{ coArt: 'A1', monto: 8 }, { coArt: 'A2', monto: 15 }]), actor);
    deps.now = at(2026, 10, 9);
    const original = deps.rates.applyPlanned;
    deps.rates.applyPlanned = async (a, plan) => { if (a.coArt === 'A2') throw new Error('boom'); return original(a, plan); };
    const failed = await patchPromotion(deps, d.id, { action: 'cancel' }, actor);
    expect(failed.status).toBe('active');
    expect(failed.items.find(i => i.coArt === 'A2')!.message).toBeTruthy();
    expect(failed.items.find(i => i.coArt === 'A2')!.message).not.toContain('boom');
    deps.rates.applyPlanned = original;
    const done = await patchPromotion(deps, d.id, { action: 'cancel' }, actor);
    expect(done.status).toBe('cancelled');
    assertNoGaps(rowsOf('A1'));
    assertNoGaps(rowsOf('A2'));
    expect(rowsOf('A1').length).toBe(4);
  });

  test('change_end extends and shortens, shifting the continuation without gaps or overlaps', async () => {
    const d = await createPromotion(deps, overlay([{ coArt: 'A1', monto: 8 }]), actor);
    const ext = await patchPromotion(deps, d.id, { action: 'change_end', endsOn: '2026-10-20' }, actor);
    expect(ext.endsOn).toBe('2026-10-20');
    expect(rowsOf('A1').map(r => [r.desde, r.hasta])).toEqual([
      ['2026-03-15', '2026-10-04'], ['2026-10-05', '2026-10-20'], ['2026-10-21', null],
    ]);
    assertNoGaps(rowsOf('A1'));
    const sh = await patchPromotion(deps, d.id, { action: 'change_end', endsOn: '2026-10-12' }, actor);
    expect(sh.endsOn).toBe('2026-10-12');
    expect(rowsOf('A1').map(r => [r.desde, r.hasta, r.monto])).toEqual([
      ['2026-03-15', '2026-10-04', 10], ['2026-10-05', '2026-10-12', 8], ['2026-10-13', null, 10],
    ]);
    assertNoGaps(rowsOf('A1'));
    expect(listAudit(deps.db).filter(x => x.action === 'promotion_extend').length).toBe(2);
  });

  test('change_end validations', async () => {
    const d = await createPromotion(deps, overlay([{ coArt: 'A1', monto: 8 }]), actor);
    await expect(patchPromotion(deps, d.id, { action: 'change_end', endsOn: '2026-10-04' }, actor)).rejects.toBeInstanceOf(ValidationError);
    await expect(getPromotionDetail(deps, 999)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('preview reports rejected rows and writes nothing', async () => {
    const before = JSON.stringify(rates.rates);
    const p = await previewPromotion(deps, overlay([{ coArt: 'A1', monto: 8 }, { coArt: 'A3', monto: 3 }]));
    expect(p.rows).toEqual([
      { coArt: 'A1', artDes: 'Harina 1kg', regular: 10, promo: 8, status: 'ok', message: null },
      { coArt: 'A3', artDes: 'Sal', regular: null, promo: 3, status: 'rejected', message: 'No hay una tarifa regular vigente para esa fecha' },
    ]);
    expect(p.customers).toEqual([]);
    expect(JSON.stringify(rates.rates)).toBe(before);
    expect(await listPromotionDtos(deps)).toEqual([]);
    expect(listAudit(deps.db)).toEqual([]);
  });

  test('segment preview resolves customers and unknown customer -> NotFoundError', async () => {
    const p = await previewPromotion(deps, segmentInput());
    expect(p.customers).toEqual([
      { coCli: 'C1', cliDes: 'Cliente Uno', previousTipCli: '000001' }, { coCli: 'C2', cliDes: 'Cliente Dos', previousTipCli: '000001' },
    ]);
    await expect(previewPromotion(deps, { ...segmentInput(), customerCodes: ['NOPE'] } as CreatePromotionInput)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('segment promotions', () => {
  test('create clones the base list, applies bounded rows, creates the special segment and moves customers', async () => {
    const d = await createPromotion(deps, segmentInput(), actor);
    expect(d.kind).toBe('segment');
    expect(d.baseCoPrecio).toBe('08');
    expect(d.desPrecio).toBe('PROMO Oferta Octubre');
    expect(d.coPrecio).not.toBe('08');
    expect(rowsOf('A1', d.coPrecio).map(r => [r.desde, r.hasta, r.monto])).toEqual([
      ['2026-10-01', '2026-10-04', 10], ['2026-10-05', '2026-10-15', 8], ['2026-10-16', null, 10],
    ]);
    expect(rowsOf('A1').length).toBe(1); // base list untouched
    expect(d.items.every(i => i.applied)).toBe(true);
    const meta = getSegmentMeta(deps.db, d.tipCli!)!;
    expect(meta).toMatchObject({ kind: 'special', customerCoCli: null, reason: 'Oferta Octubre', expiresAt: '2026-10-15', fallbackTipCli: '000001', previousTipCli: null });
    expect(seg.segments.find(s => s.tipCli === d.tipCli)!.coPrecio).toBe(d.coPrecio);
    expect(seg.customers.C1.tipCli).toBe(d.tipCli!);
    expect(seg.customers.C2.tipCli).toBe(d.tipCli!);
    expect(d.customers.map(c => [c.coCli, c.cliDes, c.previousTipCli, c.moved])).toEqual([
      ['C1', 'Cliente Uno', '000001', true], ['C2', 'Cliente Dos', '000001', true],
    ]);
    expect(listCustomers(deps.db, d.id).every(c => c.previousTipCli === '000001')).toBe(true);
    expect(d).toMatchObject({ partial: false, customerCount: 2, movedCount: 2 });
    expect(listAudit(deps.db).filter(x => x.action === 'customer_move').length).toBe(2);
    expect(listAudit(deps.db).some(x => x.action === 'promotion_create')).toBe(true);
  });

  test('unknown customer -> NotFoundError and nothing is created', async () => {
    const lists = rates.lists.length;
    await expect(createPromotion(deps, { ...segmentInput(), customerCodes: ['C1', 'NOPE'] } as CreatePromotionInput, actor)).rejects.toBeInstanceOf(NotFoundError);
    expect(rates.lists.length).toBe(lists);
    expect(seg.segments.length).toBe(1);
  });

  test('clone carries the post-promo regular price even when an overlay promo is active today', async () => {
    rates.rates = rates.rates.filter(r => r.coArt !== 'A1');
    rates.rates.push(row('A1', '2026-03-15', '2026-09-30', 10), row('A1', '2026-10-01', '2026-10-03', 6), row('A1', '2026-10-04', null, 10));
    const d = await createPromotion(deps, { ...segmentInput(), items: [{ coArt: 'A1', monto: 8 }] } as CreatePromotionInput, actor);
    expect(rowsOf('A1', d.coPrecio).map(r => r.monto)).toEqual([10, 8, 10]);
  });

  test('move conflict leaves the customer unmoved (partial); retry moves only that customer', async () => {
    seg.moveConflict = true;
    const d = await createPromotion(deps, segmentInput(), actor);
    expect(d.customers.map(c => c.moved)).toEqual([false, false]);
    expect(d.partial).toBe(true);
    seg.moveConflict = false;
    const first = await retryPromotion(deps, d.id, actor);
    expect(first.partial).toBe(false);
  });

  test('conflict for C2 only: C1 moved, C2 not; retry after clearing moves only C2', async () => {
    const orig = deps.segments.moveCustomer;
    deps.segments.moveCustomer = async (c, t, u) => (c === 'C2' ? { coCli: c, outcome: 'conflict' } : orig(c, t, u));
    const d = await createPromotion(deps, segmentInput(), actor);
    expect(d.customers.map(c => [c.coCli, c.moved])).toEqual([['C1', true], ['C2', false]]);
    expect(d.partial).toBe(true);
    expect(d.movedCount).toBe(1);
    deps.segments.moveCustomer = orig;
    const calls: string[] = [];
    deps.segments.moveCustomer = async (c, t, u) => { calls.push(c); return orig(c, t, u); };
    const r = await retryPromotion(deps, d.id, actor);
    expect(calls).toEqual(['C2']);
    expect(r.partial).toBe(false);
    expect(seg.customers.C2.tipCli).toBe(d.tipCli!);
  });

  test('cancel reverts rates and sends customers back to their previous segment', async () => {
    const d = await createPromotion(deps, segmentInput(), actor);
    const c = await patchPromotion(deps, d.id, { action: 'cancel' }, actor);
    expect(c.status).toBe('cancelled');
    expect(seg.customers.C1.tipCli).toBe('000001');
    expect(seg.customers.C2.tipCli).toBe('000001');
    expect(c.customers.every(x => !x.moved)).toBe(true);
    assertNoGaps(rowsOf('A1', d.coPrecio));
    expect(new Set(rowsOf('A1', d.coPrecio).map(r => r.monto)).size).toBe(1);
    expect(getSegmentMeta(deps.db, d.tipCli!)!.expiresAt).toBe('2026-09-30');
  });

  test('cancel falls back to the segment fallback when the previous segment no longer exists', async () => {
    const d = await createPromotion(deps, segmentInput(), actor);
    seg.segments.push({ tipCli: '000009', desTipo: 'X', coPrecio: '08', desPrecio: null, customerCount: 0, validador: '0x1' });
    // previous segment 000001 disappears -> the segment fallback is used
    seg.segments = seg.segments.filter(s => s.tipCli !== '000001');
    upsertSegmentMeta(deps.db, { tipCli: d.tipCli!, kind: 'special', customerCoCli: null, reason: 'Oferta Octubre', expiresAt: '2026-10-15', fallbackTipCli: '000009', previousTipCli: null, createdBy: '7', createdAt: 1 });
    await patchPromotion(deps, d.id, { action: 'cancel' }, actor);
    expect(seg.customers.C1.tipCli).toBe('000009');
  });

  test('change_end also moves the segment expiry', async () => {
    const d = await createPromotion(deps, segmentInput(), actor);
    await patchPromotion(deps, d.id, { action: 'change_end', endsOn: '2026-10-20' }, actor);
    expect(getSegmentMeta(deps.db, d.tipCli!)!.expiresAt).toBe('2026-10-20');
    assertNoGaps(rowsOf('A1', d.coPrecio));
  });

  test('SQLite metadata failure after the ERP create returns a warning instead of failing', async () => {
    deps.db.run(sql`DROP TABLE pricing_segment_meta`);
    const d = await createPromotion(deps, segmentInput(), actor);
    expect(d.warning).toBeTruthy();
    expect(d.tipCli).toBeTruthy();
    expect(d.customers.every(c => c.moved)).toBe(true);
  });
});
