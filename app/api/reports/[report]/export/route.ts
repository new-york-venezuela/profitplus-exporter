import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getSession } from '@/lib/auth/get-session';
import { REPORTS }    from '@/lib/reports/registry';
import { getPool }    from '@/lib/db/mssql';
import { buildCsv }   from '@/lib/csv';
import { getPreviousMonthRange, parseDate } from '@/lib/dates';
import { mapVentasRows } from '@/lib/reports/ventas-mapper';
import { mapComprasRows, buildComprasCsv } from '@/lib/routes/api/reports/compras-csv';

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
  const config = Object.hasOwn(REPORTS, reportId) ? REPORTS[reportId] : undefined;
  if (!config) return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 });

  // Defense-in-depth: validate procedure names
  if (config.sourceName && !/^[\w.[\]]+$/.test(config.sourceName)) {
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
      const sucursal = sp.get('sucursal') ?? '000001';

      const req = pool.request()
        .input('cCo_Sucursal', sql.Char(6), sucursal)
        .input('sCo_fecha_d', sql.SmallDateTime, `${start}`)
        .input('sCo_fecha_h', sql.SmallDateTime, `${end}`);
      const res = await req.execute(config.sourceName!);
      rows = res.recordset;

      if (reportId === 'compras') {
        const comprasRows = mapComprasRows(rows);
        return new NextResponse(buildComprasCsv(cols, comprasRows), {
          headers: {
            'Content-Type':        'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${reportId}_${start}_${end}.csv"`,
          },
        });
      }

      if (reportId === 'ventas') {
        rows = mapVentasRows(rows);
      }
    }

    const csv      = buildCsv(cols, rows);
    const filename = `${reportId}_${start}_${end}.csv`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Error al consultar la base de datos' }, { status: 500 });
  }
}
