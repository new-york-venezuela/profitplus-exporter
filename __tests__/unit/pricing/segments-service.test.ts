// __tests__/unit/pricing/segments-service.test.ts
import { describe, test, expect, beforeEach } from 'bun:test';
import { makeMemoryDb } from '../../helpers/memory-db';
import {
  createSegment, patchSegment, assignCustomers, listSegmentDtos,
  NotFoundError, ConflictError, ValidationError, type SegmentErp, type ServiceDeps,
} from '@/lib/pricing/segments-service';
import { listAudit, getSegmentMeta } from '@/lib/pricing/segments-repo';
import type { SegmentRow } from '@/lib/pricing/tipo-cliente';

const actor = { id: '7', erpUser: 'PROFIT' };
const now = () => new Date(2026, 9, 1);

function fakeErp(seed: { segments: SegmentRow[]; customers: Record<string, { cliDes: string; tipCli: string }> }) {
  const state = { segments: [...seed.segments], customers: { ...seed.customers }, conflictNext: false, moveConflict: false };
  const erp: SegmentErp = {
    listCodes: async () => state.segments.map(s => s.tipCli),
    listSegments: async () => state.segments,
    getSegment: async t => state.segments.find(s => s.tipCli === t) ?? null,
    createSegment: async p => { state.segments.push({ tipCli: p.tipCli, desTipo: p.desTipo, coPrecio: p.coPrecio, desPrecio: null, customerCount: 0, validador: '0x0000000000000001' }); },
    updateSegment: async p => {
      if (state.conflictNext) return 'conflict';
      const s = state.segments.find(x => x.tipCli === p.tipCli)!;
      if (p.desTipo) s.desTipo = p.desTipo;
      if (p.coPrecio) s.coPrecio = p.coPrecio;
      return 'success';
    },
    getCustomer: async c => state.customers[c] ? { coCli: c, ...state.customers[c] } : null,
    moveCustomer: async (c, target) => {
      const cur = state.customers[c];
      if (!cur) return { coCli: c, outcome: 'error', message: 'Cliente no encontrado' };
      if (state.moveConflict) return { coCli: c, outcome: 'conflict' };
      const previousTipCli = cur.tipCli;
      cur.tipCli = target;
      return { coCli: c, outcome: 'success', previousTipCli };
    },
  };
  return { erp, state };
}

const seg = (tipCli: string, desTipo: string, coPrecio = '01'): SegmentRow =>
  ({ tipCli, desTipo, coPrecio, desPrecio: null, customerCount: 0, validador: '0x0000000000000001' });

let deps: ServiceDeps;
let state: ReturnType<typeof fakeErp>['state'];

beforeEach(() => {
  const f = fakeErp({
    segments: [seg('000001', 'INDEPENDIENTE'), seg('TP1151', 'Test Price List TP1151', 'TP1151')],
    customers: { C1: { cliDes: 'Bodega El Sol', tipCli: '000001' }, C2: { cliDes: 'Otra', tipCli: '000001' } },
  });
  state = f.state;
  deps = { erp: f.erp, db: makeMemoryDb(), now };
});

describe('createSegment', () => {
  test('group: allocates next code, stores meta, audits', async () => {
    const { segment } = await createSegment(deps, { kind: 'group', desTipo: 'Bodegones', coPrecio: '07' }, actor);
    expect(segment.tipCli).toBe('000002');            // TP1151 ignored, 000001 is max
    expect(segment.kind).toBe('group');
    expect(listAudit(deps.db).map(a => a.action)).toEqual(['segment_create']);
  });

  test('special: generated name, previous/fallback recorded, customer moved', async () => {
    const { segment, move } = await createSegment(deps, {
      kind: 'special', customerCoCli: 'C1', reason: 'promo oct', expiresOn: '2026-10-31', coPrecio: '07',
    }, actor);
    expect(segment.desTipo).toBe('Bodega El Sol · promo oct · hasta 31/10');
    expect(segment.kind).toBe('special');
    expect(segment.daysLeft).toBe(30);
    expect(move?.outcome).toBe('success');
    const meta = getSegmentMeta(deps.db, segment.tipCli)!;
    expect(meta).toMatchObject({ previousTipCli: '000001', fallbackTipCli: '000001', customerCoCli: 'C1', createdBy: '7' });
    expect(state.customers.C1.tipCli).toBe(segment.tipCli);
    expect(listAudit(deps.db).map(a => a.action).sort()).toEqual(['customer_move', 'segment_create']);
  });

  test('special: move conflict leaves the segment created and flags the outcome', async () => {
    state.moveConflict = true;
    const { segment, move } = await createSegment(deps, {
      kind: 'special', customerCoCli: 'C1', reason: 'r', expiresOn: '2026-10-31', coPrecio: '07',
    }, actor);
    expect(move?.outcome).toBe('conflict');
    expect(await deps.erp.getSegment(segment.tipCli)).not.toBeNull();
    expect(listAudit(deps.db).map(a => a.action)).toEqual(['segment_create']);
    // a normal retry works
    state.moveConflict = false;
    const retry = await assignCustomers(deps, { customerCodes: ['C1'], targetTipCli: segment.tipCli }, actor);
    expect(retry[0].outcome).toBe('success');
  });

  test('special: unknown customer → NotFoundError and nothing created', async () => {
    await expect(createSegment(deps, { kind: 'special', customerCoCli: 'NOPE', reason: 'r', expiresOn: '2026-10-31', coPrecio: '07' }, actor))
      .rejects.toBeInstanceOf(NotFoundError);
    expect(state.segments.length).toBe(2);
  });
});

describe('patchSegment', () => {
  test('repoint updates ERP and audits before/after', async () => {
    await patchSegment(deps, '000001', { coPrecio: '08', validador: '0x0000000000000001' }, actor);
    const a = listAudit(deps.db)[0];
    expect(a.action).toBe('segment_repoint');
    expect(JSON.parse(a.beforeJson!)).toMatchObject({ coPrecio: '01' });
    expect(JSON.parse(a.afterJson!)).toMatchObject({ coPrecio: '08' });
  });
  test('stale validador → ConflictError, nothing audited', async () => {
    state.conflictNext = true;
    await expect(patchSegment(deps, '000001', { desTipo: 'Nuevo', validador: '0x0000000000000001' }, actor)).rejects.toBeInstanceOf(ConflictError);
    expect(listAudit(deps.db)).toEqual([]);
  });
  test('expiry on a group segment is a ValidationError; on a special it updates meta', async () => {
    await expect(patchSegment(deps, '000001', { expiresOn: '2026-12-01' }, actor)).rejects.toBeInstanceOf(ValidationError);
    const { segment } = await createSegment(deps, { kind: 'special', customerCoCli: 'C1', reason: 'r', expiresOn: '2026-10-31', coPrecio: '07' }, actor);
    const dto = await patchSegment(deps, segment.tipCli, { expiresOn: '2026-12-01' }, actor);
    expect(dto.expiresAt).toBe('2026-12-01');
  });
  test('unknown segment → NotFoundError', async () => {
    await expect(patchSegment(deps, 'NOPE', { desTipo: 'x', validador: '0x0000000000000001' }, actor)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('assignCustomers', () => {
  test('unknown target → NotFoundError', async () => {
    await expect(assignCustomers(deps, { customerCodes: ['C1'], targetTipCli: 'NOPE' }, actor)).rejects.toBeInstanceOf(NotFoundError);
  });
  test('audits only real moves (no-op into the same segment is not audited)', async () => {
    const r = await assignCustomers(deps, { customerCodes: ['C1', 'C2'], targetTipCli: 'TP1151' }, actor);
    expect(r.map(x => x.outcome)).toEqual(['success', 'success']);
    expect(listAudit(deps.db).length).toBe(2);
    const again = await assignCustomers(deps, { customerCodes: ['C1'], targetTipCli: 'TP1151' }, actor);
    expect(again[0].outcome).toBe('success');
    expect(listAudit(deps.db).length).toBe(2);
  });
});

describe('listSegmentDtos', () => {
  test('merges ERP rows with metadata; segments without metadata are groups; expired special has negative daysLeft', async () => {
    await createSegment(deps, { kind: 'special', customerCoCli: 'C1', reason: 'r', expiresOn: '2026-10-05', coPrecio: '07' }, actor);
    const later = { ...deps, now: () => new Date(2026, 9, 20) };
    const dtos = await listSegmentDtos(later);
    expect(dtos.find(d => d.tipCli === '000001')).toMatchObject({ kind: 'group', expiresAt: null, daysLeft: null });
    const special = dtos.find(d => d.kind === 'special')!;
    expect(special.daysLeft).toBe(-15);
  });
});
