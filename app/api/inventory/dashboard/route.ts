import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getSessionFromRequest, hasInventoryAccess } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import { inventoryWarehouses, inventorySettings } from '@/lib/db/schema';
import { getPool } from '@/lib/db/mssql';
import { trimStrings } from '@/lib/trim-strings';

export const dynamic = 'force-dynamic';

// Items with stock in a configured warehouse, and their total quantity sold
// (via saFacturaVenta/saFacturaVentaReng, excluding anulado invoices) from
// that same warehouse over the rolling window. Items with no sales in the
// window are excluded here — with no consumption data there's no meaningful
// days-of-stock estimate, so they can't be flagged as at-risk either way.
const DASHBOARD_QUERY_BASE = `
  SELECT
    a.co_art, a.art_des, s.co_alma, s.stock,
    SUM(fvr.total_art) AS sold
  FROM saArticulo a
  JOIN saStockAlmacen s ON s.co_art = a.co_art AND s.tipo = 'ACT'
  JOIN saFacturaVentaReng fvr ON fvr.co_art = a.co_art AND fvr.co_alma = s.co_alma
  JOIN saFacturaVenta fv ON fv.doc_num = fvr.doc_num
  WHERE a.anulado = 0 AND fv.anulado = 0 AND fv.fec_emis > @sinceDate
`;

interface DashboardRow {
  co_art: string; art_des: string; co_alma: string; stock: number; sold: number;
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = getDb();
  const allowed = await hasInventoryAccess(db, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

  try {
    const settings = db.select().from(inventorySettings).get()
      ?? { rollingWindowDays: 60, daysOfStockThreshold: 7 };
    const activeWarehouses = db.select().from(inventoryWarehouses).all().filter(w => w.active);

    const pool = await getPool();
    const request_ = pool.request();
    request_.input('sinceDate', sql.DateTime, new Date(Date.now() - settings.rollingWindowDays * 86_400_000));

    let query = DASHBOARD_QUERY_BASE;
    if (activeWarehouses.length > 0) {
      const placeholders = activeWarehouses.map((w, i) => {
        request_.input(`coAlma${i}`, sql.Char(6), w.coAlma);
        return `@coAlma${i}`;
      });
      query += ` AND s.co_alma IN (${placeholders.join(', ')})`;
    }
    query += ' GROUP BY a.co_art, a.art_des, s.co_alma, s.stock ORDER BY a.art_des';

    const result = await request_.query(query);
    const rows = trimStrings(result.recordset) as unknown as DashboardRow[];

    const items = rows
      .map(r => {
        const stock = Number(r.stock);
        const sold = Number(r.sold);
        const avgDailySales = sold / settings.rollingWindowDays;
        const daysOfStock = avgDailySales > 0 ? stock / avgDailySales : null;
        return {
          coArt:  r.co_art,
          artDes: r.art_des,
          coAlma: r.co_alma,
          stock,
          sold,
          avgDailySales,
          daysOfStock,
        };
      })
      .filter(item => item.daysOfStock !== null && item.daysOfStock < settings.daysOfStockThreshold)
      .sort((a, b) => (a.daysOfStock as number) - (b.daysOfStock as number));

    return NextResponse.json({
      items,
      rollingWindowDays:    settings.rollingWindowDays,
      daysOfStockThreshold: settings.daysOfStockThreshold,
    });
  } catch (error) {
    console.error('Inventory dashboard error:', error);
    return NextResponse.json({ error: 'Error al consultar Profit Plus' }, { status: 500 });
  }
}
