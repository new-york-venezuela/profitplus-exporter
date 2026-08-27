import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, hasInventoryAccess } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import { inventoryWarehouses } from '@/lib/db/schema';
import { getPool } from '@/lib/db/mssql';
import { trimStrings } from '@/lib/trim-strings';
import { assignArticleToWarehouse } from '@/lib/inventory/assign-warehouse';
import sql from 'mssql';

export const dynamic = 'force-dynamic';

// des_uni (the article's principal unit of measure) is fetched via a
// correlated scalar subquery rather than a JOIN: nothing in the schema
// enforces at most one saArtUnidad row per article with uni_principal = 1,
// and a JOIN would fan out (duplicating the article's row in this list) if
// that assumption were ever violated. A scalar subquery is at-most-one-row
// by construction, so it can't produce duplicate rows either way.
const ITEMS_QUERY_BASE = `
  SELECT
    a.co_art, a.art_des, a.ref, a.modelo, a.comentario,
    a.campo1, a.campo2, a.campo3, a.campo4, a.campo5, a.campo6, a.campo7, a.campo8,
    a.stock_min, a.stock_max, a.stock_pedido,
    a.co_lin, l.lin_des,
    a.co_cat, c.cat_des,
    s.co_alma, s.stock,
    (SELECT TOP 1 u.des_uni FROM saArtUnidad au
       JOIN saUnidad u ON u.co_uni = au.co_uni
       WHERE au.co_art = a.co_art AND au.uni_principal = 1) AS des_uni
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
  des_uni: string | null;
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
      if (activeWarehouses.length > 0 && !activeWarehouses.includes(targetCoAlma)) {
        return NextResponse.json({ error: 'Almacén no configurado para Inventario' }, { status: 400 });
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
          ORDER BY a.art_des, a.co_art
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
    query += ' ORDER BY a.art_des, a.co_art';

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
      unidad:       r.des_uni,
    }));

    return NextResponse.json(items);
  } catch (error) {
    console.error('Inventory items list error:', error);
    return NextResponse.json({ error: 'Error al consultar Profit Plus' }, { status: 500 });
  }
}

interface CreateArticleBody {
  coArt:  unknown;
  artDes: unknown;
  tipo:   unknown;
  coLin:  unknown;
  coSubl: unknown;
  coCat:  unknown;
  coUni:  unknown;
  coAlma: unknown;
}

const VALID_TIPOS = new Set(['V', 'M', 'S', 'C', 'E']);

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = getDb();
  const allowed = await hasInventoryAccess(db, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

  const body = await request.json().catch(() => null) as CreateArticleBody | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const { coArt, artDes, tipo, coLin, coSubl, coCat, coUni, coAlma } = body;
  if (typeof coArt !== 'string' || coArt.trim() === '' || coArt.length > 30) {
    return NextResponse.json({ error: 'Código de artículo inválido' }, { status: 400 });
  }
  if (typeof artDes !== 'string' || artDes.trim() === '' || artDes.length > 120) {
    return NextResponse.json({ error: 'Nombre inválido' }, { status: 400 });
  }
  if (typeof tipo !== 'string' || !VALID_TIPOS.has(tipo)) {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
  }
  if (typeof coLin !== 'string' || coLin.trim() === '') {
    return NextResponse.json({ error: 'Línea requerida' }, { status: 400 });
  }
  if (typeof coSubl !== 'string' || coSubl.trim() === '') {
    return NextResponse.json({ error: 'Sub-línea requerida' }, { status: 400 });
  }
  if (typeof coCat !== 'string' || coCat.trim() === '') {
    return NextResponse.json({ error: 'Categoría requerida' }, { status: 400 });
  }
  if (typeof coUni !== 'string' || coUni.trim() === '') {
    return NextResponse.json({ error: 'Unidad requerida' }, { status: 400 });
  }
  if (typeof coAlma !== 'string' || coAlma.trim() === '') {
    return NextResponse.json({ error: 'Almacén requerido' }, { status: 400 });
  }

  const activeWarehouses = db.select().from(inventoryWarehouses).all().filter(w => w.active);
  if (activeWarehouses.length > 0 && !activeWarehouses.some(w => w.coAlma === coAlma)) {
    return NextResponse.json({ error: 'Almacén no configurado para Inventario' }, { status: 400 });
  }

  try {
    const pool = await getPool();

    const req = pool.request();
    req.input('sCoArt', sql.Char(30), coArt);
    req.input('sArtDes', sql.VarChar(120), artDes);
    req.input('sTipo', sql.Char(1), tipo);
    req.input('sCoLin', sql.Char(6), coLin);
    req.input('sCoSubl', sql.Char(6), coSubl);
    req.input('sCoCat', sql.Char(6), coCat);
    req.input('sCoUni', sql.Char(6), coUni);
    req.input('sCoUsIn', sql.Char(6), 'PROFIT');
    req.input('sCoSucuIn', sql.Char(6), null);
    await req.execute('pApiCrearArticuloInventario');

    const warehouseResult = await assignArticleToWarehouse(pool, coArt, coAlma);
    if (!warehouseResult.ok) {
      return NextResponse.json({
        ok: true,
        coArt,
        warehouseError: `Artículo creado, pero no se pudo asignar al almacén: ${warehouseResult.error}`,
      });
    }

    return NextResponse.json({ ok: true, coArt });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'number' in error && (error as { number: unknown }).number === 50000) {
      const message = 'message' in error && typeof (error as { message: unknown }).message === 'string'
        ? (error as { message: string }).message
        : 'No se pudo crear el artículo';
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error('Article creation error:', error);
    return NextResponse.json({ error: 'Error al crear el artículo en Profit Plus' }, { status: 500 });
  }
}
