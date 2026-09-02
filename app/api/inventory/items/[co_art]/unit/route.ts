import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getSessionFromRequest, hasInventoryAccess } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import { getPool } from '@/lib/db/mssql';

export const dynamic = 'force-dynamic';

interface UpdateUnitBody {
  coUniNueva: unknown;
}

const CO_US_IN = 'PROFIT';
const CO_SUCU_IN = null;

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
  if (typeof co_art !== 'string' || co_art.trim() === '') {
    return NextResponse.json({ error: 'Código de artículo requerido' }, { status: 400 });
  }

  const body = await request.json().catch(() => null) as UpdateUnitBody | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const { coUniNueva } = body;
  if (typeof coUniNueva !== 'string' || coUniNueva.trim() === '') {
    return NextResponse.json({ error: 'Unidad requerida' }, { status: 400 });
  }

  try {
    const pool = await getPool();
    const req = pool.request();
    req.input('sCoArt', sql.Char(30), co_art);
    req.input('sCoUniNueva', sql.Char(6), coUniNueva);
    req.input('sCoUsIn', sql.Char(6), CO_US_IN);
    req.input('sCoSucuIn', sql.Char(6), CO_SUCU_IN);

    await req.execute('pApiCambiarUnidadArticulo');

    return NextResponse.json({ ok: true, coArt: co_art, coUniNueva });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'number' in error && (error as { number: unknown }).number === 50000) {
      const message = 'message' in error && typeof (error as { message: unknown }).message === 'string'
        ? (error as { message: string }).message
        : 'No se pudo cambiar la unidad del artículo';
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error('Change article unit error:', error);
    return NextResponse.json({ error: 'Error al cambiar la unidad en Profit Plus' }, { status: 500 });
  }
}
