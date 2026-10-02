import { describe, test, expect } from 'bun:test';
import { validateCreateListBody, validateApplyRatesBody, validateRenameListBody } from '@/lib/pricing/list-validators';
const today = '2026-10-01';
describe('validateCreateListBody', () => {
  test('create needs name ≤ 60 and a currency code', () => {
    expect(validateCreateListBody({ mode: 'create', desPrecio: 'Nueva', coMone: 'USD' }, today).ok).toBe(true);
    expect(validateCreateListBody({ mode: 'create', desPrecio: '', coMone: 'USD' }, today).ok).toBe(false);
    expect(validateCreateListBody({ mode: 'create', desPrecio: 'x', coMone: '' }, today).ok).toBe(false);
  });
  test('clone needs source, name, valid percent (−99..1000 or null) and a non-past start', () => {
    const ok = { mode: 'clone', sourceCoPrecio: '08', desPrecio: 'Copia', percent: -8, effectiveFrom: '2026-10-01' };
    expect(validateCreateListBody(ok, today).ok).toBe(true);
    expect(validateCreateListBody({ ...ok, percent: null }, today).ok).toBe(true);
    expect(validateCreateListBody({ ...ok, percent: -100 }, today).ok).toBe(false);
    expect(validateCreateListBody({ ...ok, effectiveFrom: '2026-09-30' }, today).ok).toBe(false);
  });
});
describe('validateApplyRatesBody', () => {
  const ok = { effectiveFrom: '2026-10-01', changes: [{ coArt: 'A1', monto: 12.4 }] };
  test('accepts', () => expect(validateApplyRatesBody(ok, today).ok).toBe(true));
  test('rejects past date, empty, duplicates, non-positive, >5 decimals, >500', () => {
    expect(validateApplyRatesBody({ ...ok, effectiveFrom: '2026-09-01' }, today).ok).toBe(false);
    expect(validateApplyRatesBody({ ...ok, changes: [] }, today).ok).toBe(false);
    expect(validateApplyRatesBody({ ...ok, changes: [{ coArt: 'A', monto: 1 }, { coArt: 'A', monto: 2 }] }, today).ok).toBe(false);
    expect(validateApplyRatesBody({ ...ok, changes: [{ coArt: 'A', monto: 0 }] }, today).ok).toBe(false);
    expect(validateApplyRatesBody({ ...ok, changes: [{ coArt: 'A', monto: 1.123456 }] }, today).ok).toBe(false);
    expect(validateApplyRatesBody({ ...ok, changes: Array.from({ length: 501 }, (_, i) => ({ coArt: `A${i}`, monto: 1 })) }, today).ok).toBe(false);
  });
});
describe('validateRenameListBody', () => {
  test('name + validador', () => {
    expect(validateRenameListBody({ desPrecio: 'Nuevo', validador: '0x00000000000A1B2C' }).ok).toBe(true);
    expect(validateRenameListBody({ desPrecio: 'Nuevo', validador: 'x' }).ok).toBe(false);
  });
});
