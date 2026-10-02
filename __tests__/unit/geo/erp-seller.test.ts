import { describe, test, expect } from 'bun:test';
import type sql from 'mssql';
import { updateCustomerSeller, SellerNotFoundError, normalizeCoVen } from '@/lib/geo/erp-seller';
import { CustomerNotFoundError, ERP_USER_CODE } from '@/lib/geo/erp-location';

function stubPool(execute: (name: string, inputs: Record<string, unknown>) => Promise<unknown>) {
  const inputs: Record<string, unknown> = {};
  const request = {
    input(name: string, _type: unknown, value: unknown) { inputs[name] = value; return request; },
    execute: (name: string) => execute(name, inputs),
  };
  return { pool: { request: () => request } as unknown as sql.ConnectionPool, inputs };
}

describe('updateCustomerSeller', () => {
  test('calls the procedure with trimmed codes and the ERP user', async () => {
    let called = '';
    const { pool, inputs } = stubPool(async name => { called = name; return {}; });
    await updateCustomerSeller(pool, '  J-1  ', ' 000003 ');
    expect(called).toBe('pApiActualizarVendedorCliente');
    expect(inputs).toEqual({ sCoCli: 'J-1', sCoVen: '000003', sCoUsMo: ERP_USER_CODE });
  });

  test('maps "Cliente ... no encontrado" to CustomerNotFoundError', async () => {
    const { pool } = stubPool(async () => { throw new Error('Cliente J-9 no encontrado'); });
    await expect(updateCustomerSeller(pool, 'J-9', '000003')).rejects.toBeInstanceOf(CustomerNotFoundError);
  });

  test('maps "Vendedor ... no encontrado o inactivo" to SellerNotFoundError', async () => {
    const { pool } = stubPool(async () => { throw new Error('Vendedor 999999 no encontrado o inactivo'); });
    await expect(updateCustomerSeller(pool, 'J-1', '999999')).rejects.toBeInstanceOf(SellerNotFoundError);
  });

  test('other errors propagate unchanged', async () => {
    const { pool } = stubPool(async () => { throw new Error('boom'); });
    await expect(updateCustomerSeller(pool, 'J-1', '000003')).rejects.toThrow('boom');
  });

  test('rejects empty codes before touching the DB', async () => {
    const { pool } = stubPool(async () => { throw new Error('should not be called'); });
    await expect(updateCustomerSeller(pool, '  ', '000003')).rejects.toThrow('coCli');
    await expect(updateCustomerSeller(pool, 'J-1', '  ')).rejects.toThrow('coVen');
    await expect(updateCustomerSeller(pool, 'J-1', '1234567')).rejects.toThrow('coVen');
  });
});

describe('normalizeCoVen', () => {
  test('trims, bounds to 6 chars, rejects non-strings', () => {
    expect(normalizeCoVen(' 000003 ')).toBe('000003');
    expect(normalizeCoVen('')).toBeNull();
    expect(normalizeCoVen('1234567')).toBeNull();
    expect(normalizeCoVen(5)).toBeNull();
  });
});
