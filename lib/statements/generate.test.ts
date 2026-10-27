import { describe, expect, mock, test } from 'bun:test';
import { generateStatementPdf } from './generate';

const pool = {} as never;
const header = { coCli: 'C1', name: 'Cliente Uno', rif: 'J-1', address: 'Calle 1' };
const docs = [{ coTipoDoc: 'FACT', nroDoc: '1', fecEmis: new Date(2026, 8, 1), fecVenc: new Date(2026, 8, 10), saldoBsd: 100 }];
const rates = [{ fecha: new Date(2026, 7, 1), tasaV: 50 }];
const base = {
  fetchOpenDocs: async () => docs,
  fetchUsdRates: async () => rates,
  fetchCompanyName: async () => 'Empresa',
};

describe('generateStatementPdf', () => {
  test('returns null for unknown customer', async () => {
    const r = await generateStatementPdf(pool, 'X', { deps: { ...base, fetchCustomerHeader: async () => null } });
    expect(r).toBeNull();
  });
  test('returns a PDF for a known customer', async () => {
    const r = await generateStatementPdf(pool, 'C1', { deps: { ...base, fetchCustomerHeader: async () => header } });
    expect(r!.pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(r!.fileName).toEndWith('.pdf');
    expect(r!.customerName).toBe('Cliente Uno');
  });
  test('reuses provided company without fetching it', async () => {
    const fetchCompany = mock(async () => 'Otra');
    const render = mock(async () => Buffer.from('%PDF-'));
    await generateStatementPdf(pool, 'C1', {
      company: 'Pasada',
      deps: { ...base, fetchCompanyName: fetchCompany, fetchCustomerHeader: async () => header, renderStatementPdf: render as never },
    });
    expect(fetchCompany).not.toHaveBeenCalled();
    expect((render.mock.calls[0] as unknown as [{ company: string }])[0].company).toBe('Pasada');
  });
  test('reuses provided rates and warns on unknown types', async () => {
    const fetchRates = mock(async () => rates);
    const warn = mock(() => {});
    const orig = console.warn; console.warn = warn as never;
    try {
      const r = await generateStatementPdf(pool, 'C1', {
        rates,
        deps: {
          ...base, fetchUsdRates: fetchRates,
          fetchOpenDocs: async () => [{ ...docs[0], coTipoDoc: 'ZZZ' }],
          fetchCustomerHeader: async () => header,
        },
      });
      expect(r).not.toBeNull();
    } finally { console.warn = orig; }
    expect(fetchRates).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });
});
