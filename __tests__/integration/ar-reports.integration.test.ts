import { describe, test, expect } from 'bun:test';
import { getPool } from '@/lib/db/mssql';
import { fetchCxcPendientes } from '@/lib/reports/queries/cxc-pendientes-query';
import { fetchRetenciones } from '@/lib/reports/queries/retenciones-query';
import { splitTaxBuckets, type LineAgg } from '@/lib/reports/tax-buckets';

// Read-only reconciliation against the live ERP. If the line-total check
// fails, fix lineBaseExpr / EXEMPT_TIPO_IMP, never the tolerance.
describe('AR reports (read-only ERP)', () => {
  test('open invoices with lines: base + exento + iva = total_neto', async () => {
    const pool = await getPool();
    const rows = await fetchCxcPendientes(pool, {});
    const withLines = rows.filter(r => (r.lines as LineAgg[]).length > 0).slice(0, 50);
    expect(withLines.length).toBeGreaterThan(0);

    for (const r of withLines) {
      const b = splitTaxBuckets(r.lines as LineAgg[])!;
      const diff = Math.abs(b.base + b.exento + b.iva - Number(r.total_neto));
      expect({ nro_doc: String(r.nro_doc).trim(), ok: diff <= 0.01 })
        .toEqual({ nro_doc: String(r.nro_doc).trim(), ok: true });
    }
  });

  test('retenciones: only contribuyentes especiales and no zero balance', async () => {
    const pool = await getPool();
    const rows = await fetchRetenciones(pool, {});
    expect(rows.every(r => Number(r.saldo) !== 0)).toBe(true);

    const names = [...new Set(rows.map(r => String(r.cli_des).trim()))].slice(0, 20);
    if (names.length === 0) return;
    const check = await pool.request().query(`
      SELECT COUNT(*) AS bad FROM saCliente
      WHERE RTRIM(cli_des) IN (${names.map(n => `'${n.replace(/'/g, "''")}'`).join(',')})
        AND ISNULL(contrib, 0) <> 1
    `);
    expect(check.recordset[0].bad).toBe(0);
  });
});
