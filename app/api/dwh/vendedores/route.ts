import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { hasDwhAccess } from '@/lib/dwh/access';
import { getDb } from '@/lib/db/sqlite';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { getUsdRate, buildDateWhereClause } from '@/app/api/dwh/lib/query-builder';
import type { VendedoresResponse, VendedoresRow } from '@/app/(app)/analitica/types';

export const dynamic = 'force-dynamic';

// Reads from the pre-aggregated dwh/dim/fact schema in DWH_AlimentosNY (see
// dwh-migrations/), not the raw Profit Plus ERP — no COLLATE/RTRIM gymnastics
// needed here, that work already happened at load time.

function salesRepQuery(salesDateWhere: string, returnsDateWhere: string, collectionsDateWhere: string): string {
  return `
    SELECT
      ISNULL(r.SalesRepName, r.SalesRepCode) AS Name,
      SUM(fs.NetAmount) AS SalesNet,
      SUM(fs.GrossAmount) AS GrossAmount,
      SUM(fs.DiscountAmount) AS DiscountAmount,
      (SELECT ISNULL(SUM(fr.NetAmount), 0)
         FROM fact.Fact_Returns fr
         WHERE fr.SalesRepKey = fs.SalesRepKey AND fr.IsVoided = 0 ${returnsDateWhere}) AS ReturnsNet,
      (SELECT ISNULL(SUM(fc.AmountCollected), 0)
         FROM fact.Fact_Collections fc
         WHERE fc.SalesRepKey = fs.SalesRepKey AND fc.IsVoided = 0 ${collectionsDateWhere}) AS Collected
    FROM fact.Fact_Sales fs
    JOIN dim.Dim_SalesRep r ON r.SalesRepKey = fs.SalesRepKey
    WHERE fs.IsVoided = 0 ${salesDateWhere}
    GROUP BY fs.SalesRepKey, ISNULL(r.SalesRepName, r.SalesRepCode)
    ORDER BY SalesNet DESC
  `;
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = getDb();
  const allowed = await hasDwhAccess(db, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const dateRange = searchParams.get('dateRange') ?? '12m';
  const currency = searchParams.get('currency') ?? 'bs';

  try {
    const pool = await getDwhPool();

    const salesDateWhere = buildDateWhereClause(dateRange, 'fs');
    const returnsDateWhere = buildDateWhereClause(dateRange, 'fr');
    const collectionsDateWhere = buildDateWhereClause(dateRange, 'fc');

    const [salesReps, usdRate] = await Promise.all([
      pool.request().query(salesRepQuery(salesDateWhere, returnsDateWhere, collectionsDateWhere)),
      currency === 'usd' ? getUsdRate() : Promise.resolve(null),
    ]);

    const rows: VendedoresRow[] = salesReps.recordset.map(r => {
      const salesNet = Number(r.SalesNet);
      const returnsNet = Number(r.ReturnsNet);
      const grossAmount = Number(r.GrossAmount);
      const discountAmount = Number(r.DiscountAmount);
      const collected = Number(r.Collected);

      return {
        name: r.Name,
        salesNet,
        returnsNet,
        returnRate: salesNet > 0 ? returnsNet / salesNet : null,
        collectionRate: salesNet > 0 ? collected / salesNet : null,
        avgDiscount: grossAmount > 0 ? discountAmount / grossAmount : null,
      };
    });

    const response: VendedoresResponse = { rows, usdRate };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
