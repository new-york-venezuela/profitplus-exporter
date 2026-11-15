import { describe, expect, test } from 'bun:test';
import { mapCxcPendientesRows } from '../cxc-pendientes-mapper';
import { EXEMPT_TIPO_IMP } from '../tax-buckets';

const base = {
  nro_doc: 'F-1', fec_emis: new Date('2026-10-01T00:00:00Z'), fec_venc: new Date('2026-10-22T00:00:00Z'),
  cli_des: 'Cliente', vendedor: 'Ana', tipo_cliente: 'Abasto',
  lines: [{ tipoImp: '1', base: 100, iva: 16 }, { tipoImp: EXEMPT_TIPO_IMP, base: 50, iva: 0 }],
};

describe('mapCxcPendientesRows', () => {
  test('splits tax buckets', () => {
    const [r] = mapCxcPendientesRows([base]);
    expect(r.base_imp).toBe(100);
    expect(r.exento).toBe(50);
    expect(r.iva).toBe(16);
    expect(r.nro_factura).toBe('F-1');
    expect(r.fec_emis).toBe('2026-10-01');
    expect(r.fec_venc).toBe('2026-10-22');
  });
  test('no lines -> null, not 0', () => {
    const [r] = mapCxcPendientesRows([{ ...base, lines: [] }]);
    expect(r.base_imp).toBeNull();
    expect(r.exento).toBeNull();
    expect(r.iva).toBeNull();
  });
  test('dias_credito', () => {
    expect(mapCxcPendientesRows([base])[0].dias_credito).toBe(21);
  });
  test('null fec_venc', () => {
    const [r] = mapCxcPendientesRows([{ ...base, fec_venc: null }]);
    expect(r.fec_venc).toBe('');
    expect(r.dias_credito).toBeNull();
  });
  test('same-day due date is a real 0', () => {
    const [r] = mapCxcPendientesRows([{ ...base, fec_venc: base.fec_emis }]);
    expect(r.dias_credito).toBe(0);
  });
  test('vendedor / tipo_cliente as in retenciones', () => {
    const [r] = mapCxcPendientesRows([{ ...base, vendedor: null, tipo_cliente: ' ' }]);
    expect(r.vendedor).toBe('Sin asignar');
    expect(r.tipo_cliente).toBe('Sin asignar');
  });
});
