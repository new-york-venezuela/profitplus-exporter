import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getSessionFromRequest, hasInventoryAccess } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import { inventoryWarehouses } from '@/lib/db/schema';
import { getPool } from '@/lib/db/mssql';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ co_art: string }> },
) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = getDb();
  const allowed = await hasInventoryAccess(db, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

  const { co_art } = await params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.coAlma !== 'string' || body.coAlma.trim() === '') {
    return NextResponse.json({ error: 'Almacén requerido' }, { status: 400 });
  }
  const coAlma = body.coAlma.trim();

  const activeWarehouses = db.select().from(inventoryWarehouses).all().filter(w => w.active);
  if (activeWarehouses.length > 0 && !activeWarehouses.some(w => w.coAlma === coAlma)) {
    return NextResponse.json({ error: 'Almacén no configurado para Inventario' }, { status: 400 });
  }

  try {
    const pool = await getPool();

    const existing = await pool.request()
      .input('coArt', sql.Char(30), co_art)
      .input('coAlma', sql.Char(6), coAlma)
      .query(`SELECT 1 FROM saStockAlmacen WHERE co_art = @coArt AND co_alma = @coAlma AND tipo = 'ACT'`);
    if (existing.recordset.length > 0) {
      return NextResponse.json({ error: 'El artículo ya tiene stock registrado en ese almacén' }, { status: 400 });
    }

    const article = await pool.request()
      .input('coArt', sql.Char(30), co_art)
      .query(`SELECT 1 FROM saArticulo WHERE co_art = @coArt AND anulado = 0`);
    if (article.recordset.length === 0) {
      return NextResponse.json({ error: 'Artículo no encontrado' }, { status: 404 });
    }

    // Column list (co_art, co_alma, tipo, stock) is inferred from existing
    // saStockAlmacen reads in this module (adjustments/route.ts, items/route.ts,
    // items/[co_art]/route.ts all filter/select exactly these four columns) —
    // NOT verified via a live sys.columns dump, because no MSSQL server was
    // reachable in this development environment (confirmed: nothing listens on
    // localhost:1433; the docker mock ERP here does not have the real Ncake_a
    // schema loaded). Unlike every other write in this module (an UPDATE or a
    // stored-procedure call), this is a plain INSERT into a table this module
    // has never written to before, so there is a real risk saStockAlmacen has
    // additional NOT NULL columns without defaults that this statement would
    // violate. VERIFY THIS COLUMN LIST AGAINST A LIVE/STAGING PROFIT PLUS
    // SCHEMA (see task-2-brief.md Step 1) BEFORE THIS CODE SHIPS TO PRODUCTION.
    await pool.request()
      .input('coArt', sql.Char(30), co_art)
      .input('coAlma', sql.Char(6), coAlma)
      .query(`INSERT INTO saStockAlmacen (co_art, co_alma, tipo, stock) VALUES (@coArt, @coAlma, 'ACT', 0)`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Add article to warehouse error:', error);
    return NextResponse.json({ error: 'Error al registrar el almacén en Profit Plus' }, { status: 500 });
  }
}
