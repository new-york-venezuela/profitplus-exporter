import type sql from 'mssql';
import { buildDateWhereClause, usdConversionJoin, dualAmountExpr } from '@/app/api/dwh/lib/query-builder';
import type { ErpCustomerRow, RevenueRow } from './merge';

// Live ERP read. Active customers only; RTRIM because char() columns are
// space-padded. campo1 holds the "Coordenadas: (lat, lng)" text.
export async function fetchErpCustomers(pool: sql.ConnectionPool): Promise<ErpCustomerRow[]> {
  const result = await pool.request().query(`
    SELECT RTRIM(c.co_cli)   AS coCli,
           RTRIM(c.cli_des)  AS name,
           RTRIM(c.rif)      AS rif,
           RTRIM(c.co_ven)   AS coVen,
           RTRIM(v.ven_des)  AS sellerName,
           RTRIM(c.direc1)   AS direc1,
           RTRIM(c.dir_ent2) AS dirEnt2,
           RTRIM(c.campo1)   AS campo1
    FROM saCliente c
    LEFT JOIN saVendedor v ON v.co_ven = c.co_ven
    WHERE c.inactivo = 0
    ORDER BY c.cli_des
  `);
  return result.recordset as ErpCustomerRow[];
}

// DWH read. Dim_Customer is SCD2 (several rows per customer) and
// CustomerCode is char-padded, so group by RTRIM(CustomerCode). `dateRange`
// must already be validated with isValidDateRange(); buildDateWhereClause
// only ever emits digits matched by a regex.
export async function fetchRevenue(dwhPool: sql.ConnectionPool, dateRange: string): Promise<RevenueRow[]> {
  const result = await dwhPool.request().query(`
    SELECT RTRIM(c.CustomerCode) AS coCli,
           ${dualAmountExpr('fs', 'NetAmount', 'RevenueBs', 'RevenueUsd')}
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
    ${usdConversionJoin('fs')}
    WHERE fs.IsVoided = 0 ${buildDateWhereClause(dateRange, 'fs')}
    GROUP BY RTRIM(c.CustomerCode)
  `);
  return result.recordset.map((r: { coCli: string; RevenueBs: number | null; RevenueUsd: number | null }) => ({
    coCli: r.coCli,
    revenueBs: Number(r.RevenueBs ?? 0),
    revenueUsd: r.RevenueUsd === null ? null : Number(r.RevenueUsd),
  }));
}
