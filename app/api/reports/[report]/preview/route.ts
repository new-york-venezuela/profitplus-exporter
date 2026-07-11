import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getSession } from '@/lib/auth/get-session';
import { REPORTS }    from '@/lib/reports/registry';
import { getPool }    from '@/lib/db/mssql';
import { getPreviousMonthRange, parseDate } from '@/lib/dates';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ report: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { report: reportId } = await params;
  const config = REPORTS[reportId];
  if (!config) return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 });

  const sp    = request.nextUrl.searchParams;
  const def   = getPreviousMonthRange();
  const start = parseDate(sp.get('startDate')) ?? def.startDate;
  const end   = parseDate(sp.get('endDate'))   ?? def.endDate;

  try {
    const pool = await getPool();
    let totalCount: number;
    let rows: Record<string, unknown>[];

    if (config.queryType === 'view') {
      const dc = config.dateColumn!;
      const countRes = await pool.request()
        .input('startDate', sql.NVarChar, start)
        .input('endDate',   sql.NVarChar, end)
        .query(
          `SELECT COUNT(*) AS total FROM [${config.sourceName}] ` +
          `WHERE [${dc}] BETWEEN @startDate AND @endDate`,
        );
      totalCount = countRes.recordset[0].total as number;

      const dataRes = await pool.request()
        .input('startDate', sql.NVarChar, start)
        .input('endDate',   sql.NVarChar, end)
        .query(
          `SELECT TOP 100 * FROM [${config.sourceName}] ` +
          `WHERE [${dc}] BETWEEN @startDate AND @endDate`,
        );
      rows = dataRes.recordset;
    } else {
      const res = await pool.request()
        .input('startDate', sql.NVarChar, start)
        .input('endDate',   sql.NVarChar, end)
        .execute(config.sourceName);
      rows       = res.recordset.slice(0, 100);
      totalCount = res.recordset.length;
    }

    return NextResponse.json({ rows, total: totalCount });
  } catch {
    return NextResponse.json({ error: 'Error al consultar la base de datos' }, { status: 500 });
  }
}
