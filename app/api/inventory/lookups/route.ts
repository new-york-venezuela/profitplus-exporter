import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, hasInventoryAccess } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import { getPool } from '@/lib/db/mssql';
import { trimStrings } from '@/lib/trim-strings';

export const dynamic = 'force-dynamic';

// Only the 6 production saTipoAjuste reasons are exposed — the two
// manual-recount codes (E00003/S00005) are reserved for the existing
// recount flow and never offered as a "simple ajuste" motivo.
const PRODUCTION_TIPO_AJUSTE_CODES = ['E00001', 'E00002', 'S00001', 'S00002', 'S00003', 'S00004'];

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = getDb();
  const allowed = await hasInventoryAccess(db, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

  try {
    const pool = await getPool();

    const [lineasResult, sublineasResult, categoriasResult, unidadesResult, motivosResult] = await Promise.all([
      pool.request().query(`SELECT co_lin, lin_des FROM saLineaArticulo ORDER BY lin_des`),
      pool.request().query(`SELECT co_lin, co_subl, subl_des FROM saSubLinea ORDER BY co_lin, subl_des`),
      pool.request().query(`SELECT co_cat, cat_des FROM saCatArticulo ORDER BY cat_des`),
      pool.request().query(`SELECT co_uni, des_uni FROM saUnidad ORDER BY des_uni`),
      pool.request().query(`
        SELECT co_tipo, des_tipo, tipo_trans FROM saTipoAjuste
        WHERE co_tipo IN ('${PRODUCTION_TIPO_AJUSTE_CODES.join("','")}')
        ORDER BY des_tipo
      `),
    ]);

    const lineas = trimStrings(lineasResult.recordset) as unknown as Array<{ co_lin: string; lin_des: string }>;
    const sublineas = trimStrings(sublineasResult.recordset) as unknown as Array<{ co_lin: string; co_subl: string; subl_des: string }>;
    const categorias = trimStrings(categoriasResult.recordset) as unknown as Array<{ co_cat: string; cat_des: string }>;
    const unidades = trimStrings(unidadesResult.recordset) as unknown as Array<{ co_uni: string; des_uni: string }>;
    const motivos = trimStrings(motivosResult.recordset) as unknown as Array<{ co_tipo: string; des_tipo: string; tipo_trans: string }>;

    return NextResponse.json({
      lineas: lineas.map(l => ({ coLin: l.co_lin, linDes: l.lin_des })),
      sublineas: sublineas.map(s => ({ coLin: s.co_lin, coSubl: s.co_subl, sublDes: s.subl_des })),
      categorias: categorias.map(c => ({ coCat: c.co_cat, catDes: c.cat_des })),
      unidades: unidades.map(u => ({ coUni: u.co_uni, desUni: u.des_uni })),
      motivos: motivos.map(m => ({ coTipo: m.co_tipo, desTipo: m.des_tipo, tipoTrans: m.tipo_trans })),
    });
  } catch (error) {
    console.error('Inventory lookups error:', error);
    return NextResponse.json({ error: 'Error al consultar Profit Plus' }, { status: 500 });
  }
}
