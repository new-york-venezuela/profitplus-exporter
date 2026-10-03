// __tests__/unit/pricing/segments-service.test.ts
import { describe, test, expect, beforeEach } from 'bun:test';
import { makeMemoryDb } from '../../helpers/memory-db';
import { makeFakeSegmentErp } from '../../helpers/fake-segment-erp';
import {
  createSegment, patchSegment, assignCustomers, listSegmentDtos,
  NotFoundError, ConflictError, ValidationError, type SegmentErp, type ServiceDeps,
} from '@/lib/pricing/segments-service';
import { listAudit, getSegmentMeta } from '@/lib/pricing/segments-repo';
import type { SegmentRow } from '@/lib/pricing/tipo-cliente';

const actor = { id: '7', erpUser: 'PROFIT' };
const now = () => new Date(2026, 9, 1);

const seg = (tipCli: string, desTipo: string, coPrecio = '01'): SegmentRow =>
  ({ tipCli, desTipo, coPrecio, desPrecio: null, customerCount: 0, validador: '0x0000000000000001' });

let deps: ServiceDeps;
let state: ReturnType<typeof makeFakeSegmentErp>['state'];

beforeEach(() => {
  const f = makeFakeSegmentErp({
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

describe('createSegment resilience', () => {
  const brokenDb = () => new Proxy(deps.db, {
    get: (t, k, r) => (k === 'insert' ? () => { throw new Error('sqlite down'); } : Reflect.get(t, k, r)),
  });
  const quiet = async <T,>(fn: () => Promise<T>) => {
    const orig = console.error; console.error = () => {};
    try { return await fn(); } finally { console.error = orig; }
  };

  test('group: metadata failure after ERP create still returns the segment plus a warning', async () => {
    const r = await quiet(() => createSegment({ ...deps, db: brokenDb() }, { kind: 'group', desTipo: 'Bodegones', coPrecio: '07' }, actor));
    expect(r.segment.tipCli).toBe('000002');
    expect(r.warning).toBe('Segmento creado en Profit pero sin metadatos; avise a un administrador');
    expect(state.segments.some(x => x.tipCli === '000002')).toBe(true);
  });
  test('special: metadata failure still moves the customer and warns', async () => {
    const r = await quiet(() => createSegment({ ...deps, db: brokenDb() }, { kind: 'special', customerCoCli: 'C1', reason: 'r', expiresOn: '2026-10-31', coPrecio: '07' }, actor));
    expect(r.warning).toContain('sin metadatos');
    expect(r.move?.outcome).toBe('success');
    expect(state.customers.C1.tipCli).toBe(r.segment.tipCli);
  });
  test('success path has no warning', async () => {
    expect((await createSegment(deps, { kind: 'group', desTipo: 'x', coPrecio: '07' }, actor)).warning).toBeUndefined();
  });
  test('duplicate-key ERP error is retried once with a recomputed code', async () => {
    const real = deps.erp.createSegment;
    let calls = 0;
    const erp: SegmentErp = {
      ...deps.erp,
      createSegment: async p => {
        calls++;
        if (calls === 1) {
          state.segments.push(seg('000002', 'tomado por otro')); // concurrent creator took the code
          throw Object.assign(new Error('Violation of PRIMARY KEY'), { number: 2627 });
        }
        return real(p);
      },
    };
    const r = await createSegment({ ...deps, erp }, { kind: 'group', desTipo: 'Nuevo', coPrecio: '07' }, actor);
    expect(calls).toBe(2);
    expect(r.segment.tipCli).toBe('000003');
  });
  test('a second duplicate-key error propagates; other errors are not retried', async () => {
    let calls = 0;
    const erp: SegmentErp = { ...deps.erp, createSegment: async () => { calls++; throw Object.assign(new Error('dup'), { number: 2601 }); } };
    await expect(createSegment({ ...deps, erp }, { kind: 'group', desTipo: 'x', coPrecio: '07' }, actor)).rejects.toThrow('dup');
    expect(calls).toBe(2);
    calls = 0;
    const erp2: SegmentErp = { ...deps.erp, createSegment: async () => { calls++; throw new Error('boom'); } };
    await expect(createSegment({ ...deps, erp: erp2 }, { kind: 'group', desTipo: 'x', coPrecio: '07' }, actor)).rejects.toThrow('boom');
    expect(calls).toBe(1);
  });
  test('special: unknown fallbackTipCli → NotFoundError and nothing created', async () => {
    await expect(createSegment(deps, { kind: 'special', customerCoCli: 'C1', reason: 'r', expiresOn: '2026-10-31', coPrecio: '07', fallbackTipCli: 'NOPE' }, actor))
      .rejects.toBeInstanceOf(NotFoundError);
    expect(state.segments.length).toBe(2);
  });
});

describe('patchSegment', () => {
  test('removing the expiry of a special segment is rejected', async () => {
    const { segment } = await createSegment(deps, { kind: 'special', customerCoCli: 'C1', reason: 'r', expiresOn: '2026-10-31', coPrecio: '07' }, actor);
    await expect(patchSegment(deps, segment.tipCli, { expiresOn: null }, actor)).rejects.toBeInstanceOf(ValidationError);
    expect(getSegmentMeta(deps.db, segment.tipCli)!.expiresAt).toBe('2026-10-31');
  });
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

describe('assignCustomers into special segments', () => {
  test('moving customers other than its own into a special segment is rejected with no writes', async () => {
    const { segment } = await createSegment(deps, { kind: 'special', customerCoCli: 'C1', reason: 'r', expiresOn: '2026-10-31', coPrecio: '07' }, actor);
    const auditBefore = listAudit(deps.db).length;
    await expect(assignCustomers(deps, { customerCodes: ['C1', 'C2'], targetTipCli: segment.tipCli }, actor)).rejects.toBeInstanceOf(ValidationError);
    expect(state.customers.C2.tipCli).toBe('000001');
    expect(listAudit(deps.db).length).toBe(auditBefore);
  });
  test('moving only its own customer is ok', async () => {
    const { segment } = await createSegment(deps, { kind: 'special', customerCoCli: 'C1', reason: 'r', expiresOn: '2026-10-31', coPrecio: '07' }, actor);
    state.customers.C1.tipCli = '000001';
    const r = await assignCustomers(deps, { customerCodes: ['C1'], targetTipCli: segment.tipCli }, actor);
    expect(r[0].outcome).toBe('success');
  });
  test('special segment with null customerCoCli rejects every code', async () => {
    const { segment } = await createSegment(deps, { kind: 'special', customerCoCli: 'C1', reason: 'r', expiresOn: '2026-10-31', coPrecio: '07' }, actor);
    const { upsertSegmentMeta } = await import('@/lib/pricing/segments-repo');
    upsertSegmentMeta(deps.db, { tipCli: segment.tipCli, kind: 'special', customerCoCli: null, createdBy: '7', createdAt: 1 });
    await expect(assignCustomers(deps, { customerCodes: ['C1'], targetTipCli: segment.tipCli }, actor)).rejects.toBeInstanceOf(ValidationError);
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
