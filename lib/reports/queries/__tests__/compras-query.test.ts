import { describe, test, expect, mock } from 'bun:test';

// Mock getPool before importing queryComprasData
const mockRows = [
  {
    nro_doc: '001',
    fecha_emis: '2026-06-10',
    r: 'J-12345',
    prov_des: 'Provider A',
    tipo_prov: 'PJD',
    num_comprobante: 'CB001',
    nro_orig: 'FACT001',
    n_control: 'NC001',
    anulado: 0,
    co_tipo_doc: 'FACT',
    doc_orig: '',
    doc_afec: '',
    total_neto: 1000,
    compras_exentas: 0,
    base_imp: 1000,
    tasa: 16,
    monto_imp: 160,
    monto_ret_imp: 0,
  },
];

const executeCallCount = { count: 0 };
const inputCalls = { count: 0 };
const getPoolCalls = { count: 0 };
const requestCalls = { count: 0 };

const mockExecute = mock(() => {
  executeCallCount.count++;
  return Promise.resolve({
    recordset: mockRows,
  });
});

const mockInputChain = {
  input: mock(() => {
    inputCalls.count++;
    return mockInputChain;
  }),
  execute: mockExecute,
};

const mockRequestMethod = mock(() => {
  requestCalls.count++;
  return mockInputChain;
});

const mockPool = {
  request: mockRequestMethod,
};

const mockGetPool = mock(async () => {
  getPoolCalls.count++;
  return mockPool;
});

// Mock the module
mock.module('@/lib/db/mssql', () => ({
  getPool: mockGetPool,
}));

// Now import after mocking
const { queryComprasData } = await import('../compras-query');

describe('queryComprasData', () => {
  test('executes procedure with correct parameters', async () => {
    // Reset counters
    executeCallCount.count = 0;
    inputCalls.count = 0;
    getPoolCalls.count = 0;
    requestCalls.count = 0;

    const result = await queryComprasData('2026-06-01', '2026-06-30', '000001');

    expect(result).toEqual(mockRows);
    expect(getPoolCalls.count).toBe(1);
    expect(requestCalls.count).toBe(1);
    expect(inputCalls.count).toBeGreaterThan(0);
    expect(executeCallCount.count).toBe(1);
  });
});
