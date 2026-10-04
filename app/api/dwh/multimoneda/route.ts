import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { getUsdRate, buildDateWhereClause, jsonWithCache } from '@/app/api/dwh/lib/query-builder';
import type { MultimonedaResponse, ExchangeRateRow } from '@/app/(app)/analitica/types';

export const dynamic = 'force-dynamic';

function trendQuery(dateWhere: string): string {
  return `
    SELECT
      d.YearMonth,
      AVG(f.RateSell) AS Rate
    FROM fact.Fact_ExchangeRate f
    JOIN dim.Dim_Date d ON d.DateKey = f.DateKey
    JOIN dim.Dim_Currency c ON c.CurrencyKey = f.CurrencyKey
    -- Only real quoted days: carried-forward rows (0036, weekends/holidays)
    -- would otherwise weight the monthly average toward non-business days.
    WHERE RTRIM(c.CurrencyCode) = 'USD' AND f.IsCarriedForward = 0 ${dateWhere}
    GROUP BY d.YearMonth
    ORDER BY d.YearMonth
  `;
}

export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const dateRange = searchParams.get('dateRange') ?? '12m';

  try {
    const pool = await getDwhPool();

    const dateWhere = buildDateWhereClause(dateRange, 'f');

    const [trend, currentRate] = await Promise.all([
      pool.request().query(trendQuery(dateWhere)),
      getUsdRate(),
    ]);

    const exchangeRates: ExchangeRateRow[] = trend.recordset.map(r => ({
      yearMonth: r.YearMonth,
      rateBcvToUsd: Number(r.Rate),
    }));

    const response: MultimonedaResponse = {
      exchangeRates,
      currentRate,
    };

    return jsonWithCache(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
