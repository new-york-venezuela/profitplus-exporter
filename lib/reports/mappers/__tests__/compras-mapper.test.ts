import { describe, test, expect } from 'bun:test';
import { mapComprasData } from '../compras-mapper';

describe('comprasMapper', () => {
  test('filters out rows with total_neto = 0', () => {
    const mainRows = [
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
        total_neto: 0,
        compras_exentas: 0,
        base_imp: 0,
        tasa: 0,
        monto_imp: 0,
        monto_ret_imp: 0,
      },
      {
        nro_doc: '002',
        fecha_emis: '2026-06-10',
        r: 'J-12346',
        prov_des: 'Provider B',
        tipo_prov: 'PJD',
        num_comprobante: 'CB002',
        nro_orig: 'FACT002',
        n_control: 'NC002',
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
    const result = mapComprasData(mainRows);
    expect(result).toHaveLength(1);
    expect(result[0].nro).toBe(1);
  });

  test('maps co_tipo_doc to correct columns', () => {
    const mainRows = [
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
        co_tipo_doc: 'N/DB',
        doc_orig: 'ND001',
        doc_afec: 'FACT999',
        total_neto: 1000,
        compras_exentas: 0,
        base_imp: 1000,
        tasa: 16,
        monto_imp: 160,
        monto_ret_imp: 0,
      },
    ];
    const result = mapComprasData(mainRows);
    expect(result[0].nro_nota_debito).toBe('ND001');
    expect(result[0].nro_factura).toBe('');
    expect(result[0].nro_factura_afectada).toBe('FACT999');
  });

  test('converts anulado to tipo_transaccion', () => {
    const mainRows = [
      {
        nro_doc: '001',
        fecha_emis: '2026-06-10',
        r: 'J-12345',
        prov_des: 'Provider A',
        tipo_prov: 'PJD',
        num_comprobante: 'CB001',
        nro_orig: 'FACT001',
        n_control: 'NC001',
        anulado: 1,
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
    const result = mapComprasData(mainRows);
    expect(result[0].tipo_transaccion).toBe('03-anu');
  });
});
