import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { buildDateWhereClause, jsonWithCache } from '@/app/api/dwh/lib/query-builder';
import { getDb } from '@/lib/db/sqlite';
import { visitCadenceTargets } from '@/lib/db/schema';
import { resolveTarget } from './target-resolution';
import type { CadenceRow, CadenceResponse, CustomerSegment } from '@/app/(app)/analitica/types';

export const dynamic = 'force-dynamic';

// Reads from the pre-aggregated dwh/dim/fact schema in DWH_AlimentosNY (see
// dwh-migrations/) for purchase frequency, and the app's own SQLite for
// manually-set targets (visit_cadence_targets). See docs/superpowers/specs/
// 2026-09-21-active-customer-visit-cadence-design.md.
//
// DaysSinceLastPurchase is computed against GETDATE() regardless of the
// selected date range's end — intentionally always "how overdue right now,"
// not relative to a historical report window.

function cadenceQuery(dateWhere: string): string {
  return `
    ;WITH PurchaseDays AS (
      SELECT DISTINCT le.LegalEntityKey, le.LegalEntityName, c.SegmentCode, d.FullDate
      FROM fact.Fact_Sales fs
      JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
      JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = c.LegalEntityKey
      JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
      WHERE fs.IsVoided = 0 ${dateWhere}
    ),
    Gaps AS (
      SELECT
        LegalEntityKey,
        FullDate,
        DATEDIFF(day, LAG(FullDate) OVER (PARTITION BY LegalEntityKey ORDER BY FullDate), FullDate) AS GapDays
      FROM PurchaseDays
    )
    SELECT
      le.LegalEntityKey,
      le.LegalEntityName,
      MAX(pd.SegmentCode) AS SegmentCode,
      COUNT(DISTINCT pd.FullDate) AS PurchaseDayCount,
      AVG(CAST(g.GapDays AS float)) AS AvgGapDays,
      MAX(pd.FullDate) AS LastPurchaseDate,
      DATEDIFF(day, MAX(pd.FullDate), GETDATE()) AS DaysSinceLastPurchase
    FROM dim.Dim_LegalEntity le
    JOIN PurchaseDays pd ON pd.LegalEntityKey = le.LegalEntityKey
    LEFT JOIN Gaps g ON g.LegalEntityKey = le.LegalEntityKey AND g.GapDays IS NOT NULL
    GROUP BY le.LegalEntityKey, le.LegalEntityName
    ORDER BY DaysSinceLastPurchase DESC, le.LegalEntityKey
  `;
}

export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const dateRange = searchParams.get('dateRange') ?? '12m';
  const dateWhere = buildDateWhereClause(dateRange, 'fs');

  try {
    const pool = await getDwhPool();
    const result = await pool.request().query(cadenceQuery(dateWhere));

    const db = getDb();
    const targetRows = db.select().from(visitCadenceTargets).all();
    const entityOverrides = new Map<number, number>();
    const segmentDefaults = new Map<string, number>();
    for (const t of targetRows) {
      if (t.legalEntityKey !== null) entityOverrides.set(t.legalEntityKey, t.targetGapDays);
      else if (t.segmentCode !== null) segmentDefaults.set(t.segmentCode, t.targetGapDays);
    }

    const rows: CadenceRow[] = result.recordset.map(r => {
      const legalEntityKey = Number(r.LegalEntityKey);
      const segmentRaw = r.SegmentCode === null ? null : String(r.SegmentCode);
      const segment: CustomerSegment | null = segmentRaw === 'CADENA' || segmentRaw === 'INDEPENDIENTES' ? segmentRaw : null;
      const targetGapDays = resolveTarget(legalEntityKey, segment, entityOverrides, segmentDefaults);
      const daysSinceLastPurchase = Number(r.DaysSinceLastPurchase);

      return {
        legalEntityKey,
        legalEntityName: String(r.LegalEntityName),
        purchaseDayCount: Number(r.PurchaseDayCount),
        avgGapDays: r.AvgGapDays === null ? null : Number(r.AvgGapDays),
        lastPurchaseDate: new Date(r.LastPurchaseDate).toISOString().slice(0, 10),
        daysSinceLastPurchase,
        segment,
        targetGapDays,
        isOverdue: targetGapDays === null ? null : daysSinceLastPurchase > targetGapDays,
      };
    });

    const response: CadenceResponse = { rows };
    return jsonWithCache(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
