import { describe, expect, test } from 'bun:test';
import { mapRetencionesRows } from '../retenciones-mapper';

const base = {
  co_tipo_doc: 'FACT', nro_doc: '1', fec_emis: new Date('2026-03-05T00:00:00Z'),
  cli_des: 'Cliente', vendedor: 'Ana', tipo_cliente: 'Abasto', monto_imp: 160, saldo: 200,
};

describe('mapRetencionesRows', () => {
  test('FACT: iva_total and 75%', () => {
    const [r] = mapRetencionesRows([base]);
    expect(r.iva_total).toBe(160);
    expect(r.retencion_75).toBe(120);
    expect(r.tipo_doc).toBe('FACT');
    expect(r.nro_doc).toBe('1');
    expect(r.saldo).toBe(200);
    expect(r.fec_emis).toBe('2026-03-05');
  });
  test('rounds to 2 decimals', () => {
    expect(mapRetencionesRows([{ ...base, monto_imp: 33.33 }])[0].retencion_75).toBe(25);
  });
  test('integer-cent rounding: IVA 1.30 -> 0.98', () => {
    expect(mapRetencionesRows([{ ...base, monto_imp: 1.3 }])[0].retencion_75).toBe(0.98);
  });
  test('null monto_imp -> null, not 0', () => {
    const [r] = mapRetencionesRows([{ ...base, monto_imp: null }]);
    expect(r.iva_total).toBeNull();
    expect(r.retencion_75).toBeNull();
  });
  test('N/CR keeps type and positive values', () => {
    const [r] = mapRetencionesRows([{ ...base, co_tipo_doc: 'N/CR' }]);
    expect(r.tipo_doc).toBe('N/CR');
    expect(r.iva_total).toBe(160);
    expect(r.retencion_75).toBe(120);
  });
  test('blank tipo_cliente -> Sin asignar', () => {
    expect(mapRetencionesRows([{ ...base, tipo_cliente: '' }])[0].tipo_cliente).toBe('Sin asignar');
    expect(mapRetencionesRows([{ ...base, tipo_cliente: null }])[0].tipo_cliente).toBe('Sin asignar');
  });
  test('blank vendedor -> Sin asignar', () => {
    expect(mapRetencionesRows([{ ...base, vendedor: '' }])[0].vendedor).toBe('Sin asignar');
    expect(mapRetencionesRows([{ ...base, vendedor: null }])[0].vendedor).toBe('Sin asignar');
  });
});
