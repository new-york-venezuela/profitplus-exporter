import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import { inventoryWarehouses } from '@/lib/db/schema';
import { getPool } from '@/lib/db/mssql';
import { trimStrings } from '@/lib/trim-strings';

export const dynamic = 'force-dynamic';

// Almacenes que efectivamente mueven stock hoy (materiales=1 o con fila
// en saStockAlmacen) — evita listar los ~50 códigos de ruta de reparto /
// placeholders sin usar que existen en Profit Plus pero no aplican al
// módulo de Inventario. Ver erp-knowledge-base/docs/tables/saAlmacen.md.
const PROFIT_PLUS_WAREHOUSES_QUERY = `
  SELECT DISTINCT a.co_alma, a.des_alma
  FROM saAlmacen a
  WHERE a.materiales = 1
     OR EXISTS (SELECT 1 FROM saStockAlmacen s WHERE s.co_alma = a.co_alma AND s.stock <> 0)
  ORDER BY a.co_alma
`;

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

  try {
    const pool = await getPool();
    const result = await pool.request().query(PROFIT_PLUS_WAREHOUSES_QUERY);
    const rows = trimStrings(result.recordset) as Array<{ co_alma: string; des_alma: string | null }>;

    const db = getDb();
    const configured = new Set(db.select().from(inventoryWarehouses).all().map(w => w.coAlma));

    const options = rows
      .filter(r => !configured.has(r.co_alma))
      .map(r => ({ coAlma: r.co_alma, label: r.des_alma ?? r.co_alma }));

    return NextResponse.json(options);
  } catch (error) {
    console.error('Profit Plus warehouse options error:', error);
    return NextResponse.json({ error: 'Error al consultar Profit Plus' }, { status: 500 });
  }
}
