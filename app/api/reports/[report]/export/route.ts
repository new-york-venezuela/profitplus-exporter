import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getSession } from '@/lib/auth/get-session';
import { REPORTS }    from '@/lib/reports/registry';
import { getPool }    from '@/lib/db/mssql';
import { buildCsv }   from '@/lib/csv';
import { buildXlsx }  from '@/lib/xlsx';
import { getPreviousMonthRange, parseDate } from '@/lib/dates';
import { trimStrings } from '@/lib/trim-strings';
import { mapVentasRows } from '@/lib/reports/ventas-mapper';
import { runQueryReport } from '@/lib/reports/query-reports';
import { mapComprasRows, buildComprasCsv } from '@/lib/routes/api/reports/compras-csv';
import { captureEvent, captureException } from '@/lib/analytics/posthog';

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

function respondFile(
  cols: ReturnType<typeof resolveColumns>,
  rows: Record<string, unknown>[],
  format: 'xlsx' | 'csv',
  stem: string,
): NextResponse {
  if (format === 'xlsx') {
    const buffer = buildXlsx(cols, rows);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${stem}.xlsx"`,
      },
    });
  }
  return new NextResponse(buildCsv(cols, rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${stem}.csv"`,
    },
  });
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
  const isQuery = config.queryType === 'query';
  const def    = getPreviousMonthRange();
  const start  = isQuery ? parseDate(sp.get('startDate')) ?? undefined : parseDate(sp.get('startDate')) ?? def.startDate;
  const end    = isQuery ? parseDate(sp.get('endDate'))   ?? undefined : parseDate(sp.get('endDate'))   ?? def.endDate;
  const cols   = resolveColumns(config, sp.get('cols'));

  const formatParam = sp.get('format') ?? 'xlsx'; // Default to xlsx
  if (formatParam !== 'xlsx' && formatParam !== 'csv') {
    return NextResponse.json({ error: 'Formato inválido' }, { status: 400 });
  }
  const format = formatParam as 'xlsx' | 'csv';

  if (cols.length === 0) {
    return NextResponse.json(
      { error: 'Sin columnas configuradas. Actualiza la definición del reporte.' },
      { status: 422 },
    );
  }

  const track = (rowCount: number) =>
    captureEvent(session.sub, 'report_exported', {
      report: reportId,
      format,
      startDate: start,
      endDate: end,
      rowCount,
    });

  try {
    const pool = await getPool();
    let rows: Record<string, unknown>[];

    if (config.queryType === 'query') {
      rows = await runQueryReport(reportId, pool, { startDate: start, endDate: end });
      track(rows.length);
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const stem = !config.snapshot && start && end
        ? `${reportId}_${start}_${end}`
        : `${reportId}_${today}`;
      return respondFile(cols, rows, format, stem);
    }

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
      rows = trimStrings(res.recordset);

      if (reportId === 'compras') {
        const comprasRows = mapComprasRows(rows);

        track(comprasRows.length);

        if (format === 'xlsx') return respondFile(cols, comprasRows, 'xlsx', `${reportId}_${start}_${end}`);

        // CSV fallback for compras
        return new NextResponse(buildComprasCsv(cols, comprasRows), {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${reportId}_${start}_${end}.csv"`,
          },
        });
      }

      if (reportId === 'ventas') {
        rows = mapVentasRows(rows);
      }
    }

    track(rows.length);

    return respondFile(cols, rows, format, `${reportId}_${start}_${end}`);
  } catch (error) {
    console.error('Export error:', error);
    captureException(error, session.sub, { report: reportId, format });
    return NextResponse.json({ error: 'Error al consultar la base de datos' }, { status: 500 });
  }
}
