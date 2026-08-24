import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, hasInventoryAccess } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import { inventoryWarehouses } from '@/lib/db/schema';
import { getPool } from '@/lib/db/mssql';
import { trimStrings } from '@/lib/trim-strings';
import sql from 'mssql';

export const dynamic = 'force-dynamic';

const ITEMS_QUERY_BASE = `
  SELECT
    a.co_art, a.art_des, a.ref, a.modelo, a.comentario,
    a.campo1, a.campo2, a.campo3, a.campo4, a.campo5, a.campo6, a.campo7, a.campo8,
    a.stock_min, a.stock_max, a.stock_pedido,
    a.co_lin, l.lin_des,
    a.co_cat, c.cat_des,
    s.co_alma, s.stock
  FROM saArticulo a
  LEFT JOIN saLineaArticulo l ON l.co_lin = a.co_lin
  LEFT JOIN saCatArticulo c ON c.co_cat = a.co_cat
  JOIN saStockAlmacen s ON s.co_art = a.co_art AND s.tipo = 'ACT'
  WHERE a.anulado = 0
`;

interface ItemRow {
  co_art: string; art_des: string; ref: string | null; modelo: string | null;
  comentario: string | null;
  campo1: string | null; campo2: string | null; campo3: string | null; campo4: string | null;
  campo5: string | null; campo6: string | null; campo7: string | null; campo8: string | null;
  stock_min: number; stock_max: number; stock_pedido: number;
  co_lin: string; lin_des: string | null;
  co_cat: string; cat_des: string | null;
  co_alma: string; stock: number;
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = getDb();
  const allowed = await hasInventoryAccess(db, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

  try {
    const activeWarehouses = db.select().from(inventoryWarehouses).all()
      .filter(w => w.active).map(w => w.coAlma);

    const pool = await getPool();

    const url = new URL(request.url);
    const unstockedOnly = url.searchParams.get('unstocked') === 'true';
    if (unstockedOnly) {
      const targetCoAlma = url.searchParams.get('co_alma');
      if (!targetCoAlma) {
        return NextResponse.json({ error: 'Almacén requerido' }, { status: 400 });
      }
      const unstockedResult = await pool.request()
        .input('coAlma', sql.Char(6), targetCoAlma)
        .query(`
          SELECT a.co_art, a.art_des
          FROM saArticulo a
          WHERE a.anulado = 0
            AND NOT EXISTS (
              SELECT 1 FROM saStockAlmacen s
              WHERE s.co_art = a.co_art AND s.co_alma = @coAlma AND s.tipo = 'ACT'
            )
          ORDER BY a.art_des
        `);
      const unstockedRows = trimStrings(unstockedResult.recordset) as unknown as Array<{ co_art: string; art_des: string }>;
      return NextResponse.json(unstockedRows.map(r => ({ coArt: r.co_art, artDes: r.art_des })));
    }

    const request_ = pool.request();

    let query = ITEMS_QUERY_BASE;
    if (activeWarehouses.length > 0) {
      const placeholders = activeWarehouses.map((coAlma, i) => {
        request_.input(`coAlma${i}`, sql.Char(6), coAlma);
        return `@coAlma${i}`;
      });
      query += ` AND s.co_alma IN (${placeholders.join(', ')})`;
    }
    query += ' ORDER BY a.art_des';

    const result = await request_.query(query);
    const rows = trimStrings(result.recordset) as unknown as ItemRow[];

    const items = rows.map(r => ({
      coArt:        r.co_art,
      artDes:       r.art_des,
      ref:          r.ref,
      modelo:       r.modelo,
      comentario:   r.comentario,
      campo1: r.campo1, campo2: r.campo2, campo3: r.campo3, campo4: r.campo4,
      campo5: r.campo5, campo6: r.campo6, campo7: r.campo7, campo8: r.campo8,
      stockMin:     r.stock_min,
      stockMax:     r.stock_max,
      stockPedido:  r.stock_pedido,
      coLin:        r.co_lin,
      linDes:       r.lin_des,
      coCat:        r.co_cat,
      catDes:       r.cat_des,
      coAlma:       r.co_alma,
      stock:        r.stock,
    }));

    return NextResponse.json(items);
  } catch (error) {
    console.error('Inventory items list error:', error);
    return NextResponse.json({ error: 'Error al consultar Profit Plus' }, { status: 500 });
  }
}
