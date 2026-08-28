import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, hasInventoryAccess } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import { inventoryWarehouses } from '@/lib/db/schema';
import { getPool } from '@/lib/db/mssql';
import { trimStrings } from '@/lib/trim-strings';
import { PRODUCTION_TIPO_AJUSTE_CODES } from '@/lib/inventory/tipo-ajuste';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = getDb();
  const allowed = await hasInventoryAccess(db, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

  const activeWarehouses = db.select().from(inventoryWarehouses).all().filter(w => w.active);

  try {
    const pool = await getPool();

    const [lineasResult, sublineasResult, categoriasResult, unidadesResult, motivosResult, almacenesResult] = await Promise.all([
      pool.request().query(`SELECT co_lin, lin_des FROM saLineaArticulo ORDER BY lin_des`),
      pool.request().query(`SELECT co_lin, co_subl, subl_des FROM saSubLinea ORDER BY co_lin, subl_des`),
      pool.request().query(`SELECT co_cat, cat_des FROM saCatArticulo ORDER BY cat_des`),
      pool.request().query(`SELECT co_uni, des_uni FROM saUnidad ORDER BY des_uni`),
      pool.request().query(`
        SELECT co_tipo, des_tipo, tipo_trans FROM saTipoAjuste
        WHERE co_tipo IN ('${PRODUCTION_TIPO_AJUSTE_CODES.join("','")}')
        ORDER BY des_tipo
      `),
      // Only queried to build the fallback below (allowlist empty = "no
      // restriction configured", matching checkWarehouseAllowed's semantics
      // in app/api/inventory/adjustments/route.ts) — real warehouses that
      // actually move stock, same filter as the admin
      // profit-plus-options route.
      activeWarehouses.length === 0
        ? pool.request().query(`
            SELECT DISTINCT a.co_alma, a.des_alma
            FROM saAlmacen a
            WHERE a.materiales = 1
               OR EXISTS (SELECT 1 FROM saStockAlmacen s WHERE s.co_alma = a.co_alma AND s.stock <> 0)
            ORDER BY a.co_alma
          `)
        : Promise.resolve({ recordset: [] }),
    ]);

    const lineas = trimStrings(lineasResult.recordset) as unknown as Array<{ co_lin: string; lin_des: string }>;
    const sublineas = trimStrings(sublineasResult.recordset) as unknown as Array<{ co_lin: string; co_subl: string; subl_des: string }>;
    const categorias = trimStrings(categoriasResult.recordset) as unknown as Array<{ co_cat: string; cat_des: string }>;
    const unidades = trimStrings(unidadesResult.recordset) as unknown as Array<{ co_uni: string; des_uni: string }>;
    const motivos = trimStrings(motivosResult.recordset) as unknown as Array<{ co_tipo: string; des_tipo: string; tipo_trans: string }>;
    const almacenes = trimStrings(almacenesResult.recordset) as unknown as Array<{ co_alma: string; des_alma: string | null }>;

    const warehouses = activeWarehouses.length > 0
      ? activeWarehouses.map(w => ({ coAlma: w.coAlma, label: w.label }))
      : almacenes.map(a => ({ coAlma: a.co_alma, label: a.des_alma ?? a.co_alma }));

    return NextResponse.json({
      lineas: lineas.map(l => ({ coLin: l.co_lin, linDes: l.lin_des })),
      sublineas: sublineas.map(s => ({ coLin: s.co_lin, coSubl: s.co_subl, sublDes: s.subl_des })),
      categorias: categorias.map(c => ({ coCat: c.co_cat, catDes: c.cat_des })),
      unidades: unidades.map(u => ({ coUni: u.co_uni, desUni: u.des_uni })),
      motivos: motivos.map(m => ({ coTipo: m.co_tipo, desTipo: m.des_tipo, tipoTrans: m.tipo_trans })),
      warehouses,
    });
  } catch (error) {
    console.error('Inventory lookups error:', error);
    return NextResponse.json({ error: 'Error al consultar Profit Plus' }, { status: 500 });
  }
}
