import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getSessionFromRequest, hasInventoryAccess } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import { inventoryWarehouses } from '@/lib/db/schema';
import { getPool } from '@/lib/db/mssql';

export const dynamic = 'force-dynamic';

// Column list (co_art, co_alma, tipo, stock) verified live against sys.columns
// on the dev DB on 2026-08-26: co_alma, co_art, tipo, and stock are the only
// NOT NULL saStockAlmacen columns without a default. revisado and trasnfe are
// nullable. validador is NOT NULL but is a `timestamp` (rowversion) column
// auto-populated by SQL Server and cannot be supplied explicitly. Safe as a
// plain INSERT.
export async function assignArticleToWarehouse(
  pool: sql.ConnectionPool,
  coArt: string,
  coAlma: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const existing = await pool.request()
    .input('coArt', sql.Char(30), coArt)
    .input('coAlma', sql.Char(6), coAlma)
    .query(`SELECT 1 FROM saStockAlmacen WHERE co_art = @coArt AND co_alma = @coAlma AND tipo = 'ACT'`);
  if (existing.recordset.length > 0) {
    return { ok: false, status: 400, error: 'El artículo ya tiene stock registrado en ese almacén' };
  }

  const article = await pool.request()
    .input('coArt', sql.Char(30), coArt)
    .query(`SELECT 1 FROM saArticulo WHERE co_art = @coArt AND anulado = 0`);
  if (article.recordset.length === 0) {
    return { ok: false, status: 404, error: 'Artículo no encontrado' };
  }

  await pool.request()
    .input('coArt', sql.Char(30), coArt)
    .input('coAlma', sql.Char(6), coAlma)
    .query(`INSERT INTO saStockAlmacen (co_art, co_alma, tipo, stock) VALUES (@coArt, @coAlma, 'ACT', 0)`);

  return { ok: true };
}

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
    const result = await assignArticleToWarehouse(pool, co_art, coAlma);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Add article to warehouse error:', error);
    return NextResponse.json({ error: 'Error al registrar el almacén en Profit Plus' }, { status: 500 });
  }
}
