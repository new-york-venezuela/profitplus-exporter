import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getSessionFromRequest, hasInventoryAccess } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import { inventoryWarehouses } from '@/lib/db/schema';
import { getPool } from '@/lib/db/mssql';
import { PRODUCTION_TIPO_AJUSTE_CODES } from '@/lib/inventory/tipo-ajuste';

export const dynamic = 'force-dynamic';

// Manual-recount reasons seeded by mssql-migrations/0003 — E00003 is entrada
// (surplus found), S00005 is salida (shortage found). No other saTipoAjuste
// codes are exposed through the recount path.
const TIPO_SOBRANTE = 'E00003';
const TIPO_FALTANTE = 'S00005';

// The 6 production saTipoAjuste reasons the simple-ajuste path may use —
// shared with app/api/inventory/lookups/route.ts via lib/inventory/tipo-ajuste.ts.
const SIMPLE_AJUSTE_TIPOS = new Set(PRODUCTION_TIPO_AJUSTE_CODES);

// Fixed service-account identity — this app has no per-user Profit Plus
// login mapping. sucursal is null: the AJUS_NUM consecutive's saSerie row
// has a NULL co_sucu_in (verified live), and pConsecutivoProximoOutPut
// fails to resolve it against any non-null sucursal code.
const CO_US_IN = 'PROFIT';
const CO_SUCU_IN = null;

interface RecountBody {
  coArt:        unknown;
  coAlma:       unknown;
  countedStock: unknown;
}

interface SimpleAjusteBody {
  coTipo:   unknown;
  coArt:    unknown;
  coAlma:   unknown;
  cantidad: unknown;
}

async function checkWarehouseAllowed(coAlma: string): Promise<string | null> {
  const db = getDb();
  const activeWarehouses = db.select().from(inventoryWarehouses).all().filter(w => w.active);
  if (activeWarehouses.length > 0 && !activeWarehouses.some(w => w.coAlma === coAlma)) {
    return 'Almacén no configurado para Inventario';
  }
  return null;
}

async function callAdjustmentProcedure(
  motivo: string,
  lines: Array<{ co_tipo: string; co_art: string; co_alma: string; co_uni: string; total_art: number; permitir_negativo: boolean }>,
): Promise<string> {
  const pool = await getPool();
  const lineasTable = new sql.Table('AjusteInventarioLineaType');
  lineasTable.columns.add('co_tipo', sql.Char(6));
  lineasTable.columns.add('co_art', sql.Char(30));
  lineasTable.columns.add('co_alma', sql.Char(6));
  lineasTable.columns.add('co_uni', sql.Char(6));
  lineasTable.columns.add('total_art', sql.Decimal(18, 5));
  lineasTable.columns.add('cost_unit', sql.Decimal(18, 5));
  lineasTable.columns.add('permitir_negativo', sql.Bit);
  for (const line of lines) {
    lineasTable.rows.add(line.co_tipo, line.co_art, line.co_alma, line.co_uni, line.total_art, null, line.permitir_negativo);
  }

  const req = pool.request();
  req.input('sMotivo', sql.VarChar(80), motivo);
  req.input('dtFecha', sql.SmallDateTime, new Date());
  req.input('sCoUsIn', sql.Char(6), CO_US_IN);
  req.input('sCoSucuIn', sql.Char(6), CO_SUCU_IN);
  req.input('Lineas', lineasTable);
  req.output('sAjueNumOut', sql.Char(20));

  const result = await req.execute('pApiCrearAjusteInventario');
  return (result.output.sAjueNumOut as string).trim();
}

function isRaisedError500(error: unknown): { message: string } | null {
  if (typeof error === 'object' && error !== null && 'number' in error && (error as { number: unknown }).number === 50000) {
    const message = 'message' in error && typeof (error as { message: unknown }).message === 'string'
      ? (error as { message: string }).message
      : 'El stock cambió desde que se cargó esta página; vuelva a intentar';
    return { message };
  }
  return null;
}

async function handleRecount(body: RecountBody) {
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

  const warehouseError = await checkWarehouseAllowed(coAlma);
  if (warehouseError) return NextResponse.json({ error: warehouseError }, { status: 400 });

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
    const ajueNum = await callAdjustmentProcedure('Ajuste por conteo manual', [{
      co_tipo: tipo, co_art: coArt, co_alma: coAlma, co_uni: coUni,
      total_art: Math.abs(delta), permitir_negativo: false,
    }]);

    return NextResponse.json({ ok: true, ajueNum, delta });
  } catch (error) {
    const raised = isRaisedError500(error);
    if (raised) return NextResponse.json({ error: raised.message }, { status: 400 });
    console.error('Inventory adjustment error:', error);
    return NextResponse.json({ error: 'Error al registrar el ajuste en Profit Plus' }, { status: 500 });
  }
}

async function handleSimpleAjuste(body: SimpleAjusteBody) {
  const { coTipo, coArt, coAlma, cantidad } = body;
  if (typeof coTipo !== 'string' || !SIMPLE_AJUSTE_TIPOS.has(coTipo)) {
    return NextResponse.json({ error: 'Motivo inválido' }, { status: 400 });
  }
  if (typeof coArt !== 'string' || coArt.trim() === '') {
    return NextResponse.json({ error: 'Artículo requerido' }, { status: 400 });
  }
  if (typeof coAlma !== 'string' || coAlma.trim() === '') {
    return NextResponse.json({ error: 'Almacén requerido' }, { status: 400 });
  }
  if (typeof cantidad !== 'number' || !isFinite(cantidad) || cantidad <= 0) {
    return NextResponse.json({ error: 'Cantidad inválida' }, { status: 400 });
  }

  const warehouseError = await checkWarehouseAllowed(coAlma);
  if (warehouseError) return NextResponse.json({ error: warehouseError }, { status: 400 });

  try {
    const pool = await getPool();
    const articleResult = await pool.request()
      .input('coArt', sql.Char(30), coArt)
      .input('coAlma', sql.Char(6), coAlma)
      .query(`
        SELECT TOP 1 au.co_uni
        FROM saArtUnidad au
        JOIN saStockAlmacen s ON s.co_art = au.co_art AND s.co_alma = @coAlma AND s.tipo = 'ACT'
        JOIN saArticulo a ON a.co_art = au.co_art AND a.anulado = 0
        WHERE au.co_art = @coArt
      `);
    if (articleResult.recordset.length === 0) {
      return NextResponse.json({ error: 'Artículo no encontrado en ese almacén' }, { status: 404 });
    }
    const coUni = (articleResult.recordset[0].co_uni as string).trim();

    const ajueNum = await callAdjustmentProcedure('Ajuste simple de movimiento', [{
      co_tipo: coTipo, co_art: coArt, co_alma: coAlma, co_uni: coUni,
      total_art: cantidad, permitir_negativo: false,
    }]);

    return NextResponse.json({ ok: true, ajueNum });
  } catch (error) {
    const raised = isRaisedError500(error);
    if (raised) return NextResponse.json({ error: raised.message }, { status: 400 });
    console.error('Inventory simple ajuste error:', error);
    return NextResponse.json({ error: 'Error al registrar el ajuste en Profit Plus' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = getDb();
  const allowed = await hasInventoryAccess(db, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  if ('coTipo' in body) {
    return handleSimpleAjuste(body as SimpleAjusteBody);
  }
  return handleRecount(body as RecountBody);
}
