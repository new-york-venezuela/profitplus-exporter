// app/api/pricing/price-lists/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db/mssql';
import { requirePricingAccess } from '@/lib/pricing/access';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requirePricingAccess(request, 'view');
  if (!auth.ok) return auth.response;

  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        RTRIM(tp.co_precio)  AS coPrecio,
        RTRIM(tp.des_precio) AS desPrecio,
        (
          SELECT COUNT(*)
          FROM saCliente c
          JOIN saTipoCliente tc ON tc.tip_cli = c.tip_cli
          WHERE tc.co_precio = tp.co_precio
        ) AS assignedCustomerCount
      FROM saTipoPrecio tp
      ORDER BY RTRIM(tp.des_precio)
    `);
    return NextResponse.json({ priceLists: result.recordset });
  } catch (error) {
    console.error('Pricing price-lists list error:', error);
    return NextResponse.json({ error: 'Error al consultar listas de precio' }, { status: 500 });
  }
}
