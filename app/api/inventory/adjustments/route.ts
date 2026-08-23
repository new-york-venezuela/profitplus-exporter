import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getSessionFromRequest, hasInventoryAccess } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import { inventoryWarehouses } from '@/lib/db/schema';
import { getPool } from '@/lib/db/mssql';

export const dynamic = 'force-dynamic';

// Manual-recount reasons seeded by mssql-migrations/0003 — E00003 is entrada
// (surplus found), S00005 is salida (shortage found). No other saTipoAjuste
// codes are exposed through this route.
const TIPO_SOBRANTE = 'E00003';
const TIPO_FALTANTE = 'S00005';

// Fixed service-account identity — this app has no per-user Profit Plus
// login mapping. sucursal is null: the AJUS_NUM consecutive's saSerie row
// has a NULL co_sucu_in (verified live), and pConsecutivoProximoOutPut
// fails to resolve it against any non-null sucursal code.
const CO_US_IN = 'PROFIT';
const CO_SUCU_IN = null;

interface AdjustmentBody {
  coArt:        unknown;
  coAlma:       unknown;
  countedStock: unknown;
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = getDb();
  const allowed = await hasInventoryAccess(db, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

  const body = await request.json().catch(() => null) as AdjustmentBody | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const { coArt, coAlma, countedStock } = body;
  if (typeof coArt !== 'string' || coArt.trim() === '') {
    return NextResponse.json({ error: 'Artículo requerido' }, { status: 400 });
  }
  if (typeof coAlma !== 'string' || coAlma.trim() === '') {
    return NextResponse.json({ error: 'Almacén requerido' }, { status: 400 });
  }
  if (typeof countedStock !== 'number' || !isFinite(countedStock) || countedStock < 0) {
    return NextResponse.json({ error: 'Cantidad contada inválida' }, { status: 400 });
  }

  const activeWarehouses = db.select().from(inventoryWarehouses).all().filter(w => w.active);
  if (activeWarehouses.length > 0 && !activeWarehouses.some(w => w.coAlma === coAlma)) {
    return NextResponse.json({ error: 'Almacén no configurado para Inventario' }, { status: 400 });
  }

  try {
    const pool = await getPool();

    const articleResult = await pool.request()
      .input('coArt', sql.Char(30), coArt)
      .input('coAlma', sql.Char(6), coAlma)
      .query(`
        SELECT TOP 1 au.co_uni, s.stock
        FROM saArtUnidad au
        JOIN saStockAlmacen s ON s.co_art = au.co_art AND s.co_alma = @coAlma AND s.tipo = 'ACT'
        JOIN saArticulo a ON a.co_art = au.co_art AND a.anulado = 0
        WHERE au.co_art = @coArt
      `);
    if (articleResult.recordset.length === 0) {
      return NextResponse.json({ error: 'Artículo no encontrado en ese almacén' }, { status: 404 });
    }

    const coUni = (articleResult.recordset[0].co_uni as string).trim();
    const currentStock = Number(articleResult.recordset[0].stock);
    const delta = countedStock - currentStock;

    if (delta === 0) {
      return NextResponse.json({ error: 'La cantidad contada es igual al stock actual; no hay ajuste que registrar' }, { status: 400 });
    }

    const tipo = delta > 0 ? TIPO_SOBRANTE : TIPO_FALTANTE;

    const lineasTable = new sql.Table('AjusteInventarioLineaType');
    lineasTable.columns.add('co_tipo', sql.Char(6));
    lineasTable.columns.add('co_art', sql.Char(30));
    lineasTable.columns.add('co_alma', sql.Char(6));
    lineasTable.columns.add('co_uni', sql.Char(6));
    lineasTable.columns.add('total_art', sql.Decimal(18, 5));
    lineasTable.columns.add('cost_unit', sql.Decimal(18, 5));
    lineasTable.columns.add('permitir_negativo', sql.Bit);
    lineasTable.rows.add(tipo, coArt, coAlma, coUni, Math.abs(delta), null, false);

    const req = pool.request();
    req.input('sMotivo', sql.VarChar(80), 'Ajuste por conteo manual');
    req.input('dtFecha', sql.SmallDateTime, new Date());
    req.input('sCoUsIn', sql.Char(6), CO_US_IN);
    req.input('sCoSucuIn', sql.Char(6), CO_SUCU_IN);
    req.input('Lineas', lineasTable);
    req.output('sAjueNumOut', sql.Char(20));

    const result = await req.execute('pApiCrearAjusteInventario');
    const ajueNum = (result.output.sAjueNumOut as string).trim();

    return NextResponse.json({ ok: true, ajueNum, delta });
  } catch (error) {
    console.error('Inventory adjustment error:', error);
    return NextResponse.json({ error: 'Error al registrar el ajuste en Profit Plus' }, { status: 500 });
  }
}
