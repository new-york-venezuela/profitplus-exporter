import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getSession } from '@/lib/auth/get-session';
import { REPORTS }    from '@/lib/reports/registry';
import { getPool }    from '@/lib/db/mssql';
import { buildCsv }   from '@/lib/csv';
import { getPreviousMonthRange, parseDate } from '@/lib/dates';

function resolveColumns(config: (typeof REPORTS)[string], colsParam: string | null) {
  if (colsParam) {
    const keys = colsParam.split(',').filter(Boolean);
    return config.columns
      .filter(c => keys.includes(c.key))
      .sort((a, b) => keys.indexOf(a.key) - keys.indexOf(b.key));
  }
  return config.columns
    .filter(c => c.defaultVisible || c.alwaysVisible)
    .sort((a, b) => a.defaultOrder - b.defaultOrder);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ report: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { report: reportId } = await params;
  const config = REPORTS[reportId];
  if (!config) return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 });

  // Defense-in-depth: sourceName and dateColumn come from config (not user input),
  // but we still validate they contain only safe identifier characters.
  if (!/^[\w.[\]]+$/.test(config.sourceName)) {
    return NextResponse.json({ error: 'Configuración de reporte inválida' }, { status: 500 });
  }

  const sp     = request.nextUrl.searchParams;
  const def    = getPreviousMonthRange();
  const start  = parseDate(sp.get('startDate')) ?? def.startDate;
  const end    = parseDate(sp.get('endDate'))   ?? def.endDate;
  const cols   = resolveColumns(config, sp.get('cols'));

  if (cols.length === 0) {
    return NextResponse.json(
      { error: 'Sin columnas configuradas. Actualiza la definición del reporte.' },
      { status: 422 },
    );
  }

  try {
    const pool = await getPool();
    let rows: Record<string, unknown>[];

    if (config.queryType === 'view') {
      const dc  = config.dateColumn!;
      const res = await pool.request()
        .input('startDate', sql.Date, start)
        .input('endDate',   sql.Date, end)
        .query(
          `SELECT * FROM [${config.sourceName}] ` +
          `WHERE [${dc}] BETWEEN @startDate AND @endDate`,
        );
      rows = res.recordset;
    } else {
      const res = await pool.request()
        .input('startDate', sql.Date, start)
        .input('endDate',   sql.Date, end)
        .execute(config.sourceName);
      rows = res.recordset;
    }

    const csv      = buildCsv(cols, rows);
    const filename = `${reportId}_${start}_${end}.csv`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Error al consultar la base de datos' }, { status: 500 });
  }
}
