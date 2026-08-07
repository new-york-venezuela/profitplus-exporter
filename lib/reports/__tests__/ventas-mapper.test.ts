import { describe, test, expect } from 'bun:test';
import { mapVentasRows } from '../ventas-mapper';

describe('ventasMapper', () => {
  test('FACT with num_comprobante (retention record) shows affected invoice in correct column', () => {
    const rows = [
      {
        co_tipo_doc: 'FACT',
        nro_orig: '001-RET',
        doc_afec: '001', // the invoice this retention affects
        num_comprobante: 'CB-RET-001', // retention voucher
        fecha_emis: '2026-06-10',
        r: 'J-12345',
        cli_des: 'Cliente A',
        n_control: 'NC001',
        anulado: 0,
        ventas_exentas: 0,
        base_imp: 0,
        tasa: 0,
        monto_imp: 0,
        total_neto: 0,
        monto_ret_imp: 160,
        monto_igtf: 0,
      },
    ];

    const result = mapVentasRows(rows);

    expect(result).toHaveLength(1);
    // FACT invoice number (retention's own number)
    expect(result[0].numero_factura).toBe('001-RET');
    // Retention voucher in correct column
    expect(result[0].num_comprobante_retencion).toBe('CB-RET-001');
    // Affected invoice in nro_factura_afectada column
    expect(result[0].nro_factura_afectada).toBe('001');
  });

  test('N/CR (nota crédito) maps doc_afec and nro_orig correctly', () => {
    const rows = [
      {
        co_tipo_doc: 'N/CR',
        nro_orig: 'NC-002',
        doc_afec: 'FACT-001',
        num_comprobante: '',
        fecha_emis: '2026-06-10',
        r: 'J-12345',
        cli_des: 'Cliente A',
        n_control: 'NC002',
        anulado: 0,
        ventas_exentas: 0,
        base_imp: 500,
        tasa: 16,
        monto_imp: 80,
        total_neto: 580,
        monto_ret_imp: 0,
        monto_igtf: 0,
      },
    ];

    const result = mapVentasRows(rows);

    expect(result).toHaveLength(1);
    // nro_orig goes to nro_nota_credito
    expect(result[0].nro_nota_credito).toBe('NC-002');
    // doc_afec goes to nro_factura_afectada
    expect(result[0].nro_factura_afectada).toBe('FACT-001');
  });

  test('expects trimmed values (trimStrings applied by route)', () => {
    const rows = [
      {
        co_tipo_doc: 'FACT',
        nro_orig: '001',
        doc_afec: '',
        num_comprobante: 'CB123',
        fecha_emis: '2026-06-10',
        r: 'J-12345',
        cli_des: 'Cliente A',
        n_control: 'NC001',
        anulado: 0,
        ventas_exentas: 0,
        base_imp: 1000,
        tasa: 16,
        monto_imp: 160,
        total_neto: 1160,
        monto_ret_imp: 0,
        monto_igtf: 0,
      },
    ];

    const result = mapVentasRows(rows);

    expect(result).toHaveLength(1);
    expect(result[0].numero_factura).toBe('001');
    expect(result[0].num_comprobante_retencion).toBe('CB123');
    expect(result[0].r).toBe('J-12345');
    expect(result[0].cli_des).toBe('Cliente A');
    expect(result[0].n_control).toBe('NC001');
  });
});
