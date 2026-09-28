// app/api/pricing/customers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getPool } from '@/lib/db/mssql';
import { requirePricingAccess } from '@/lib/pricing/access';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requirePricingAccess(request, 'view');
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.trim() ?? '';
  const segment = searchParams.get('segment')?.trim() ?? '';
  const priceList = searchParams.get('priceList')?.trim() ?? '';

  try {
    const pool = await getPool();
    const req = pool.request();
    const conditions: string[] = [];

    if (search) {
      req.input('search', sql.VarChar(120), `%${search}%`);
      conditions.push(`(c.cli_des LIKE @search OR RTRIM(c.co_cli) LIKE @search OR c.rif LIKE @search)`);
    }
    if (segment) {
      req.input('segment', sql.Char(6), segment);
      conditions.push(`RTRIM(c.co_seg) = RTRIM(@segment)`);
    }
    if (priceList) {
      req.input('priceList', sql.Char(6), priceList);
      conditions.push(`RTRIM(tc.co_precio) = RTRIM(@priceList)`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await req.query(`
      SELECT TOP 500
        RTRIM(c.co_cli)   AS coCli,
        c.cli_des         AS cliDes,
        RTRIM(c.co_seg)   AS coSeg,
        RTRIM(c.tip_cli)  AS tipCli,
        RTRIM(tc.co_precio)  AS coPrecio,
        RTRIM(tp.des_precio) AS desPrecio
      FROM saCliente c
      LEFT JOIN saTipoCliente tc ON tc.tip_cli = c.tip_cli
      LEFT JOIN saTipoPrecio tp ON tp.co_precio = tc.co_precio
      ${where}
      ORDER BY c.cli_des
    `);
    return NextResponse.json({ customers: result.recordset });
  } catch (error) {
    console.error('Pricing customers list error:', error);
    return NextResponse.json({ error: 'Error al consultar clientes' }, { status: 500 });
  }
}
