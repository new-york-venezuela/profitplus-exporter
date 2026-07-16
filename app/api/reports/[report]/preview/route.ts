import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getSession } from '@/lib/auth/get-session';
import { REPORTS }    from '@/lib/reports/registry';
import { getPool }    from '@/lib/db/mssql';
import { getPreviousMonthRange, parseDate } from '@/lib/dates';
import { mapVentasRows } from '@/lib/reports/ventas-mapper';
import { mapComprasRows } from '@/lib/routes/api/reports/compras-csv';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ report: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { report: reportId } = await params;
  const config = Object.hasOwn(REPORTS, reportId) ? REPORTS[reportId] : undefined;
  if (!config) return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 });

  if (config.sourceName && !/^[\w.[\]]+$/.test(config.sourceName)) {
    return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 });
  }

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
        .input('startDate', sql.Date, start)
        .input('endDate',   sql.Date, end)
        .query(
          `SELECT COUNT(*) AS total FROM [${config.sourceName}] ` +
          `WHERE [${dc}] BETWEEN @startDate AND @endDate`,
        );
      totalCount = countRes.recordset[0].total as number;

      const dataRes = await pool.request()
        .input('startDate', sql.Date, start)
        .input('endDate',   sql.Date, end)
        .query(
          `SELECT TOP 100 * FROM [${config.sourceName}] ` +
          `WHERE [${dc}] BETWEEN @startDate AND @endDate`,
        );
      rows = dataRes.recordset;
    } else {
      const sucursal = sp.get('sucursal') ?? '000001';

      const req = pool.request()
        .input('cCo_Sucursal', sql.Char(6), sucursal)
        .input('sCo_fecha_d', sql.SmallDateTime, `${start}`)
        .input('sCo_fecha_h', sql.SmallDateTime, `${end}`);
      const res = await req.execute(config.sourceName!);
      rows = res.recordset;

      if (reportId === 'ventas') {
        rows = mapVentasRows(rows);
      } else if (reportId === 'compras') {
        rows = mapComprasRows(rows);
      }

      totalCount = rows.length;
      rows = rows.slice(0, 100);
    }

    return NextResponse.json({ rows, total: totalCount });
  } catch (error) {
    console.error('Preview error:', error);
    return NextResponse.json({ error: 'Error al consultar la base de datos' }, { status: 500 });
  }
}
