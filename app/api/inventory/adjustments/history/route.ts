import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getSessionFromRequest, hasInventoryAccess } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import { getPool } from '@/lib/db/mssql';
import { trimStrings } from '@/lib/trim-strings';

export const dynamic = 'force-dynamic';

// Shows all adjustment types (recount, simple, purchase-derived, etc.).
// Users can see their own app-created adjustments plus any others that
// affected inventory (e.g., purchase order intake bumps stock automatically).
//
// SCHEMA CONFIDENCE (this table has not been queried anywhere else in this
// codebase — treat this query with more caution than most):
//   STRONG evidence — confirmed live via other code paths:
//     - saAjuste.ajue_num, saAjusteReng.ajue_num: read directly in
//       __tests__/integration/inventory-adjustments.integration.test.ts's
//       cleanup helper (`DELETE ... WHERE AR.ajue_num = @n`), which must
//       match real rows for that test's cleanup to succeed.
//     - saAjusteReng.co_art, co_alma, co_tipo, total_art: these are the
//       TVP column names app/api/inventory/adjustments/route.ts passes to
//       pApiCrearAjusteInventario. A TVP's column names don't have to
//       exactly equal the destination table's column names, so this is
//       strong-but-not-certain evidence, not confirmation.
//   WEAK evidence — plausible but unconfirmed:
//     - saAjuste.fecha: no existing code reads this specific column. It
//       matches the `fecha` naming convention used for date columns
//       elsewhere in this schema (e.g. saFacturaVenta.fec_emis is the only
//       counter-example found; other date-filtered queries in this
//       codebase, like app/api/inventory/dashboard/route.ts, use `fecha`-
//       style names), but is not directly verified against saAjuste.
// This query is untestable in this environment (no reachable MSSQL
// server) — see the @mssql integration test, which will only actually run
// against a real Profit Plus database in CI/staging.
const HISTORY_QUERY = `
  SELECT TOP (@limit)
    h.ajue_num, h.fecha, r.co_art, a.art_des, r.co_alma, r.co_tipo, r.total_art, t.des_tipo
  FROM saAjuste h
  JOIN saAjusteReng r ON r.ajue_num = h.ajue_num
  JOIN saArticulo a ON a.co_art = r.co_art
  JOIN saTipoAjuste t ON t.co_tipo = r.co_tipo
  ORDER BY h.fecha DESC, h.ajue_num DESC
`;

interface HistoryRow {
  ajue_num: string; fecha: string; co_art: string; art_des: string;
  co_alma: string; co_tipo: string; total_art: number; des_tipo: string;
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = getDb();
  const allowed = await hasInventoryAccess(db, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10) || 20, 100);

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('limit', sql.Int, limit)
      .query(HISTORY_QUERY);
    const rows = trimStrings(result.recordset) as unknown as HistoryRow[];

    const items = rows.map(r => ({
      ajueNum:  r.ajue_num,
      fecha:    r.fecha,
      coArt:    r.co_art,
      artDes:   r.art_des,
      coAlma:   r.co_alma,
      coTipo:   r.co_tipo,
      desTipo:  r.des_tipo,
      cantidad: Number(r.total_art),
    }));

    return NextResponse.json(items);
  } catch (error) {
    console.error('Adjustment history error:', error);
    return NextResponse.json({ error: 'Error al consultar Profit Plus' }, { status: 500 });
  }
}
