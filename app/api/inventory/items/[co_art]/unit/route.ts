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

// Root-caused 2026-09-21: pApiCambiarUnidadArticulo deterministically
// corrupts the TDS response — 100% reproducible across 15+ attempts,
// survives a full container restart and a clean DROP+CREATE from
// mssql-migrations/0006 — whenever its error path runs (BEGIN TRAN -> a
// real table SELECT finds nothing -> RAISERROR -> CATCH -> ROLLBACK ->
// re-RAISERROR) via a parameterized RPC call against this SQL Server 2025
// build + mssql/tedious combination. Isolated with throwaway procedures:
// the identical TRY/CATCH/RAISERROR structure with NO real table query
// never corrupts; adding a genuine `SELECT ... FROM saArticulo` inside it
// makes it corrupt every time. The procedure's SUCCESS path (no
// RAISERROR, no rollback) was never observed to corrupt in any repro, and
// retrying does not help here — this isn't a probabilistic per-connection
// issue, it reproduces every time for the same inputs. The fix is to
// pre-validate here in app code exactly what the procedure's own error
// path checks, so a normal "not found"/"invalid unit" request never
// reaches that procedure's error path at all — only genuinely valid calls
// (which take the procedure's clean success path) are sent via RPC.
async function articleExistsAndActive(coArt: string): Promise<boolean> {
  const pool = await getPool();
  const result = await pool.request()
    .input('coArt', sql.Char(30), coArt)
    .query('SELECT 1 FROM saArticulo WHERE co_art = @coArt AND anulado = 0');
  return result.recordset.length > 0;
}

async function unitExists(coUni: string): Promise<boolean> {
  const pool = await getPool();
  const result = await pool.request()
    .input('coUni', sql.Char(6), coUni)
    .query('SELECT 1 FROM saUnidad WHERE co_uni = @coUni');
  return result.recordset.length > 0;
}

async function callChangeUnit(coArt: string, coUniNueva: string): Promise<void> {
  const pool = await getPool();
  const req = pool.request();
  req.input('sCoArt', sql.Char(30), coArt);
  req.input('sCoUniNueva', sql.Char(6), coUniNueva);
  req.input('sCoUsIn', sql.Char(6), CO_US_IN);
  req.input('sCoSucuIn', sql.Char(6), CO_SUCU_IN);
  await req.execute('pApiCambiarUnidadArticulo');
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
    // Pre-validate the two conditions pApiCambiarUnidadArticulo's own error
    // path checks, so a request that would hit that error path never calls
    // the procedure at all — see the comment above callChangeUnit.
    if (!(await articleExistsAndActive(co_art))) {
      return NextResponse.json({ error: `Artículo ${co_art} no encontrado o anulado` }, { status: 400 });
    }
    if (!(await unitExists(coUniNueva))) {
      return NextResponse.json({ error: `Unidad ${coUniNueva} no existe` }, { status: 400 });
    }

    await callChangeUnit(co_art, coUniNueva);

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
