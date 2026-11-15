import { describe, test, expect } from 'bun:test';
import sql from 'mssql';
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
    const all = rows.filter(r => (r.lines as LineAgg[]).length > 0);
    const step = Math.max(1, Math.floor(all.length / 50));
    const withLines = all.filter((_, i) => i % step === 0).slice(0, 50);
    expect(withLines.length).toBeGreaterThan(0);

    for (const r of withLines) {
      const b = splitTaxBuckets(r.lines as LineAgg[])!;
      expect(r.total_neto, `total_neto missing for ${String(r.nro_doc).trim()}`).not.toBeNull();
      const diff = Math.abs((b.base ?? NaN) + (b.exento ?? NaN) + (b.iva ?? NaN) - Number(r.total_neto));
      expect({ nro_doc: String(r.nro_doc).trim(), ok: diff <= 0.01 })
        .toEqual({ nro_doc: String(r.nro_doc).trim(), ok: true });
    }
  });

  test('retenciones: only contribuyentes especiales and no zero balance', async () => {
    const pool = await getPool();
    const rows = await fetchRetenciones(pool, {});
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(r => Number(r.saldo) !== 0)).toBe(true);

    const codes = [...new Set(rows.map(r => String(r.co_cli).trim()))];
    expect(codes.length).toBeGreaterThan(0);
    const BATCH = 500;
    for (let i = 0; i < codes.length; i += BATCH) {
      const batch = codes.slice(i, i + BATCH);
      const req = pool.request();
      batch.forEach((c, n) => req.input(`c${n}`, sql.VarChar, c));
      const check = await req.query(`
        SELECT COUNT(*) AS bad FROM saCliente
        WHERE RTRIM(co_cli) IN (${batch.map((_, n) => `@c${n}`).join(',')})
          AND ISNULL(contrib, 0) <> 1
      `);
      expect(check.recordset[0].bad).toBe(0);
    }
  });
});
