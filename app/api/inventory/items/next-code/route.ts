import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, hasInventoryAccess } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import { getPool } from '@/lib/db/mssql';
import { suggestNextArticleCode } from '@/lib/inventory/next-article-code';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = getDb();
  const allowed = await hasInventoryAccess(db, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

  try {
    const pool = await getPool();
    const result = await pool.request().query(`SELECT co_art FROM saArticulo`);
    const codes = (result.recordset as Array<{ co_art: string }>).map(r => r.co_art.trim());
    return NextResponse.json({ nextCode: suggestNextArticleCode(codes) });
  } catch (error) {
    console.error('Inventory next-code error:', error);
    return NextResponse.json({ error: 'Error al consultar Profit Plus' }, { status: 500 });
  }
}
