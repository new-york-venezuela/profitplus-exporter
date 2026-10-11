import sql from 'mssql';
import { sellerKey } from './codes';
import type { MappingRow } from './types';

export async function upsertDwhMapping(pool: sql.ConnectionPool, rows: MappingRow[]): Promise<number> {
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    for (const r of rows) {
      await new sql.Request(tx)
        .input('code', sql.Char(16), r.coCli).input('grupo', sql.VarChar(60), r.grupo)
        .input('tipo', sql.VarChar(20), r.tipoCliente).input('parent', sql.VarChar(120), r.clientePrincipal)
        .input('eff', sql.VarChar(10), r.effectiveFrom)
        .query(`
          MERGE dim.Dim_CustomerMapping AS t
          USING (SELECT @code AS CustomerCode) AS s ON RTRIM(t.CustomerCode) = RTRIM(s.CustomerCode)
          WHEN MATCHED THEN UPDATE SET CustomerGroup = @grupo, CustomerType = @tipo,
               ParentCustomerName = @parent, EffectiveFrom = CONVERT(date, @eff, 23), LoadedAtUtc = SYSUTCDATETIME()
          WHEN NOT MATCHED THEN INSERT (CustomerCode, CustomerGroup, CustomerType, ParentCustomerName, EffectiveFrom)
               VALUES (@code, @grupo, @tipo, @parent, CONVERT(date, @eff, 23));`);
    }
    await tx.commit();
    return rows.length;
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

// Order matters: dimensions before facts (same rule as scripts/dwh-incremental-load.ts).
// Facts reload by themselves because the ERP writes bumped `validador` on the changed documents.
export async function runDwhRestateLoads(pool: sql.ConnectionPool): Promise<void> {
  await pool.request().batch(`
    EXEC dwh.Load_Dim_Customer;
    EXEC dwh.Load_Dim_SalesRep;
    EXEC dwh.Load_Fact_Sales;
    EXEC dwh.Load_Fact_Returns;`);
}

export interface SellerMismatch {
  table: 'Fact_Sales' | 'Fact_Returns';
  coCli: string; expected: string; actual: string | null; n: number;
}

export async function findSellerMismatches(
  pool: sql.ConnectionPool, rows: MappingRow[], sinceDateKey: number,
): Promise<SellerMismatch[]> {
  const expected = new Map(rows.filter(r => r.coVen.trim()).map(r => [r.coCli.trim().toUpperCase(), r.coVen.trim()]));
  const out: SellerMismatch[] = [];
  for (const table of ['Fact_Sales', 'Fact_Returns'] as const) {
    const res = await pool.request().input('since', sql.Int, sinceDateKey).query(`
      SELECT RTRIM(c.CustomerCode) AS coCli, RTRIM(rep.SalesRepCode) AS rep, COUNT(*) AS n
      FROM fact.${table} f
      JOIN dim.Dim_Customer c ON c.CustomerKey = f.CustomerKey
      LEFT JOIN dim.Dim_SalesRep rep ON rep.SalesRepKey = f.SalesRepKey
      WHERE f.DateKey >= @since AND f.IsVoided = 0
      GROUP BY RTRIM(c.CustomerCode), RTRIM(rep.SalesRepCode)`);
    for (const x of res.recordset as { coCli: string; rep: string | null; n: number }[]) {
      const want = expected.get(x.coCli.trim().toUpperCase());
      if (want && (x.rep == null || sellerKey(x.rep) !== sellerKey(want))) {
        out.push({ table, coCli: x.coCli, expected: want, actual: x.rep, n: x.n });
      }
    }
  }
  return out;
}
