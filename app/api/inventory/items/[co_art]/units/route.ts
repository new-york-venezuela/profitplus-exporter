import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getSessionFromRequest, hasInventoryAccess } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import { getPool } from '@/lib/db/mssql';
import { trimStrings } from '@/lib/trim-strings';

export const dynamic = 'force-dynamic';

interface UnitRow {
  co_uni: string;
  des_uni: string;
  uni_principal: boolean;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ co_art: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = getDb();
  const allowed = await hasInventoryAccess(db, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

  const { co_art: coArt } = await params;

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('coArt', sql.Char(30), coArt)
      .query(`
        SELECT au.co_uni, u.des_uni, au.uni_principal
        FROM saArtUnidad au
        JOIN saUnidad u ON u.co_uni = au.co_uni
        WHERE au.co_art = @coArt
        ORDER BY au.uni_principal DESC, u.des_uni
      `);
    const rows = trimStrings(result.recordset) as unknown as UnitRow[];
    return NextResponse.json(rows.map(r => ({
      coUni:        r.co_uni,
      desUni:       r.des_uni,
      uniPrincipal: Boolean(r.uni_principal),
    })));
  } catch (error) {
    console.error('Article units lookup error:', error);
    return NextResponse.json({ error: 'Error al consultar Profit Plus' }, { status: 500 });
  }
}
