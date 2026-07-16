import { describe, test, expect } from 'bun:test';
import { generateComprasCsv } from '../compras-csv-generator';
import type { ComprasExportRow } from '../../mappers/compras-mapper';

describe('generateComprasCsv', () => {
  test('generates CSV with proper header', () => {
    const rows: ComprasExportRow[] = [];
    const csv = generateComprasCsv(rows);
    const lines = csv.split('\n');
    expect(lines[0]).toContain('Nº,FECHA,RIF');
  });

  test('escapes commas in field values', () => {
    const rows: ComprasExportRow[] = [
      {
        nro: 1,
        fecha: '2026-06-10',
        rif: 'J-12345',
        nombre_proveedor: 'Provider, Inc.',
        tipo_proveedor: 'PJD',
        nro_comprobante: 'CB001',
        nro_factura: 'FACT001',
        nro_control: 'NC001',
        tipo_transaccion: '01-reg',
        nro_nota_debito: '',
        nro_nota_credito: '',
        nro_factura_afectada: '',
        total_compras_incluye_iva: 1000,
        compras_sin_derecho_credito: 0,
        base_imponible: 1000,
        alicuota: 16,
        impuesto_iva: 160,
        iva_retenido: 50,
      },
    ];
    const csv = generateComprasCsv(rows);
    expect(csv).toContain('"Provider, Inc."');
  });

  test('escapes quotes in field values', () => {
    const rows: ComprasExportRow[] = [
      {
        nro: 1,
        fecha: '2026-06-10',
        rif: 'J-12345',
        nombre_proveedor: 'Provider "Special" Ltd.',
        tipo_proveedor: 'PJD',
        nro_comprobante: 'CB001',
        nro_factura: 'FACT001',
        nro_control: 'NC001',
        tipo_transaccion: '01-reg',
        nro_nota_debito: '',
        nro_nota_credito: '',
        nro_factura_afectada: '',
        total_compras_incluye_iva: 1000,
        compras_sin_derecho_credito: 0,
        base_imponible: 1000,
        alicuota: 16,
        impuesto_iva: 160,
        iva_retenido: 50,
      },
    ];
    const csv = generateComprasCsv(rows);
    expect(csv).toContain('"Provider ""Special"" Ltd."');
  });

  test('handles newlines in field values', () => {
    const rows: ComprasExportRow[] = [
      {
        nro: 1,
        fecha: '2026-06-10',
        rif: 'J-12345',
        nombre_proveedor: 'Provider\nMultiline',
        tipo_proveedor: 'PJD',
        nro_comprobante: 'CB001',
        nro_factura: 'FACT001',
        nro_control: 'NC001',
        tipo_transaccion: '01-reg',
        nro_nota_debito: '',
        nro_nota_credito: '',
        nro_factura_afectada: '',
        total_compras_incluye_iva: 1000,
        compras_sin_derecho_credito: 0,
        base_imponible: 1000,
        alicuota: 16,
        impuesto_iva: 160,
        iva_retenido: 50,
      },
    ];
    const csv = generateComprasCsv(rows);
    expect(csv).toContain('"Provider\nMultiline"');
  });
});
