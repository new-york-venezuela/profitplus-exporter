import { describe, test, expect } from 'bun:test';
import type sql from 'mssql';
import { updateCustomerLocation, CustomerNotFoundError, ERP_USER_CODE } from '@/lib/geo/erp-location';

function stubPool(execute: (name: string, inputs: Record<string, unknown>) => Promise<unknown>) {
  const inputs: Record<string, unknown> = {};
  const request = {
    input(name: string, _type: unknown, value: unknown) { inputs[name] = value; return request; },
    execute: (name: string) => execute(name, inputs),
  };
  return { pool: { request: () => request } as unknown as sql.ConnectionPool, inputs };
}

describe('updateCustomerLocation', () => {
  test('calls the procedure with trimmed code, both fields and the ERP user', async () => {
    let called = '';
    const { pool, inputs } = stubPool(async name => { called = name; return {}; });
    await updateCustomerLocation(pool, { coCli: '  J-1  ', campo1: 'Coordenadas: (10.000000, -66.000000)', dirEnt2: 'Av. X' });
    expect(called).toBe('pApiActualizarUbicacionCliente');
    expect(inputs).toEqual({
      sCoCli: 'J-1', sCampo1: 'Coordenadas: (10.000000, -66.000000)', sDirEnt2: 'Av. X', sCoUsMo: ERP_USER_CODE,
    });
  });

  test('omitted fields are sent as null (= unchanged)', async () => {
    const { pool, inputs } = stubPool(async () => ({}));
    await updateCustomerLocation(pool, { coCli: 'J-1', dirEnt2: 'Av. X' });
    expect(inputs.sCampo1).toBeNull();
  });

  test('maps the procedure\'s "no encontrado" error to CustomerNotFoundError', async () => {
    const { pool } = stubPool(async () => { throw new Error('Cliente J-9 no encontrado'); });
    await expect(updateCustomerLocation(pool, { coCli: 'J-9', campo1: 'x' })).rejects.toBeInstanceOf(CustomerNotFoundError);
  });

  test('other errors propagate unchanged', async () => {
    const { pool } = stubPool(async () => { throw new Error('boom'); });
    await expect(updateCustomerLocation(pool, { coCli: 'J-1', campo1: 'x' })).rejects.toThrow('boom');
  });

  test('rejects an empty customer code before touching the DB', async () => {
    const { pool } = stubPool(async () => { throw new Error('should not be called'); });
    await expect(updateCustomerLocation(pool, { coCli: '   ', campo1: 'x' })).rejects.toThrow('coCli');
  });
});
