import sql from 'mssql';
import type { ConnectionPool, Transaction } from 'mssql';
import { hexToBuffer } from './tipo-cliente';
import { matchesExpectedCurrent, planRatePeriod, type RatePlan, type RateRow } from './rate-planner';
import { todayIso } from './dates';

export interface PriceListRow { coPrecio: string; desPrecio: string; coMone: string | null; rateCount: number; segmentCount: number; customerCount: number; validador: string }
export interface ArticleRow { coArt: string; artDes: string; coCat: string | null; catDes: string | null }
export type ApplyOutcome = { outcome: 'success' | 'skipped' | 'conflict' } | { outcome: 'rejected'; message: string };

const RATE_SELECT = `
  SELECT RTRIM(p.co_art) AS coArt, RTRIM(p.co_precio) AS coPrecio, RTRIM(p.co_alma_calculado) AS coAlma,
         CONVERT(VARCHAR(10), p.desde, 23) AS desde, CONVERT(VARCHAR(10), p.hasta, 23) AS hasta,
         CAST(p.monto AS FLOAT) AS monto, RTRIM(p.co_mone) AS coMone,
         CONVERT(VARCHAR(18), CONVERT(VARBINARY(8), p.validador), 1) AS validador
  FROM saArtPrecio p`;

const LIST_SELECT = `
  SELECT RTRIM(t.co_precio) AS coPrecio, RTRIM(t.des_precio) AS desPrecio,
         (SELECT TOP 1 RTRIM(co_mone) FROM saArtPrecio r WHERE r.co_precio = t.co_precio AND r.Inactivo = 0 AND r.co_mone IS NOT NULL
          GROUP BY co_mone ORDER BY COUNT(*) DESC) AS coMone,
         (SELECT COUNT(*) FROM saArtPrecio r WHERE r.co_precio = t.co_precio AND r.Inactivo = 0) AS rateCount,
         (SELECT COUNT(*) FROM saTipoCliente k WHERE k.co_precio = t.co_precio) AS segmentCount,
         (SELECT COUNT(*) FROM saCliente c JOIN saTipoCliente k ON k.tip_cli = c.tip_cli WHERE k.co_precio = t.co_precio) AS customerCount,
         CONVERT(VARCHAR(18), CONVERT(VARBINARY(8), t.validador), 1) AS validador
  FROM saTipoPrecio t`;

export async function listPriceLists(pool: ConnectionPool): Promise<PriceListRow[]> {
  return (await pool.request().query(`${LIST_SELECT} ORDER BY t.co_precio`)).recordset as PriceListRow[];
}
export async function getPriceList(pool: ConnectionPool, coPrecio: string): Promise<PriceListRow | null> {
  const r = await pool.request().input('p', sql.Char(6), coPrecio).query(`${LIST_SELECT} WHERE RTRIM(t.co_precio) = RTRIM(@p)`);
  return (r.recordset[0] as PriceListRow | undefined) ?? null;
}
export async function listPriceListCodes(pool: ConnectionPool): Promise<string[]> {
  return (await pool.request().query(`SELECT RTRIM(co_precio) AS c FROM saTipoPrecio`)).recordset.map((r: { c: string }) => r.c);
}
export async function listCurrencies(pool: ConnectionPool): Promise<string[]> {
  const r = await pool.request().query(`SELECT DISTINCT RTRIM(co_mone) AS m FROM saArtPrecio WHERE co_mone IS NOT NULL`);
  return [...new Set<string>([...r.recordset.map((x: { m: string }) => x.m), 'BSD', 'USD'])].sort();
}
export async function readListRates(pool: ConnectionPool, coPrecio: string): Promise<RateRow[]> {
  const r = await pool.request().input('p', sql.Char(6), coPrecio)
    .query(`${RATE_SELECT} WHERE RTRIM(p.co_precio) = RTRIM(@p) AND p.Inactivo = 0 ORDER BY p.co_art, p.desde`);
  return r.recordset as RateRow[];
}
export async function readArticleRates(pool: ConnectionPool, coArt: string): Promise<RateRow[]> {
  const r = await pool.request().input('a', sql.Char(30), coArt)
    .query(`${RATE_SELECT} WHERE RTRIM(p.co_art) = RTRIM(@a) AND p.Inactivo = 0 ORDER BY p.co_precio, p.desde`);
  return r.recordset as RateRow[];
}
export async function dominantWarehouse(pool: ConnectionPool, coPrecio?: string): Promise<string | null> {
  const req = pool.request();
  let where = 'WHERE Inactivo = 0';
  if (coPrecio) { req.input('p', sql.Char(6), coPrecio); where += ' AND RTRIM(co_precio) = RTRIM(@p)'; }
  const r = await req.query(`SELECT TOP 1 RTRIM(co_alma_calculado) AS w FROM saArtPrecio ${where} GROUP BY co_alma_calculado ORDER BY COUNT(*) DESC, co_alma_calculado`);
  return r.recordset[0]?.w ?? null;
}
export async function listArticles(pool: ConnectionPool, p: { search?: string; limit?: number }): Promise<ArticleRow[]> {
  const limit = Math.min(Math.max(Math.trunc(p.limit ?? 200) || 200, 1), 5000);
  const req = pool.request().input('limit', sql.Int, limit);
  let where = 'WHERE a.anulado = 0';
  if (p.search) { req.input('s', sql.VarChar(120), `%${p.search.replace(/[\\%_[]/g, '\\$&')}%`); where += " AND (a.art_des LIKE @s ESCAPE '\\' OR RTRIM(a.co_art) LIKE @s ESCAPE '\\')"; }
  const r = await req.query(`
    SELECT TOP (@limit) RTRIM(a.co_art) AS coArt, RTRIM(a.art_des) AS artDes, RTRIM(a.co_cat) AS coCat, RTRIM(c.cat_des) AS catDes
    FROM saArticulo a LEFT JOIN saCatArticulo c ON c.co_cat = a.co_cat ${where} ORDER BY a.art_des`);
  return r.recordset as ArticleRow[];
}
export async function getCustomerPriceList(pool: ConnectionPool, coCli: string) {
  const r = await pool.request().input('c', sql.Char(16), coCli).query(`
    SELECT RTRIM(c.co_cli) AS coCli, RTRIM(c.cli_des) AS cliDes, RTRIM(c.tip_cli) AS tipCli, RTRIM(k.co_precio) AS coPrecio
    FROM saCliente c LEFT JOIN saTipoCliente k ON k.tip_cli = c.tip_cli WHERE RTRIM(c.co_cli) = RTRIM(@c)`);
  return (r.recordset[0] as { coCli: string; cliDes: string; tipCli: string; coPrecio: string | null } | undefined) ?? null;
}

const almaParam = (a: string) => (a === 'TODOS' ? null : a);

async function readRowsTx(tx: Transaction, p: { coPrecio: string; coArt: string; coAlma: string }): Promise<RateRow[]> {
  const r = await new sql.Request(tx)
    .input('p', sql.Char(6), p.coPrecio).input('a', sql.Char(30), p.coArt).input('w', sql.Char(6), p.coAlma)
    .query(`${RATE_SELECT.replace('FROM saArtPrecio p', 'FROM saArtPrecio p WITH (UPDLOCK, HOLDLOCK)')}
            WHERE p.co_precio = @p AND p.co_art = @a AND p.co_alma_calculado = @w AND p.Inactivo = 0`);
  return r.recordset as RateRow[];
}

async function insertRowTx(tx: Transaction, p: { coArt: string; coPrecio: string; coAlma: string; desde: string; hasta: string | null; monto: number; coMone: string | null; user: string }) {
  await new sql.Request(tx)
    .input('sCoArt', sql.Char(30), p.coArt).input('sCoPrecio', sql.Char(6), p.coPrecio)
    .input('sCoAlma', sql.Char(6), almaParam(p.coAlma))
    .input('sDesde', sql.Char(10), p.desde).input('sHasta', sql.Char(10), p.hasta)
    .input('deMonto', sql.Decimal(18, 5), p.monto).input('sCoMone', sql.Char(6), p.coMone)
    .input('sCoUsIn', sql.Char(6), p.user.slice(0, 6))
    .execute('pApiInsertarPrecioArticulo');
}

async function updateRowTx(tx: Transaction, row: RateRow, set: { desde?: string; hasta?: string | null; monto?: number }, user: string): Promise<'success' | 'conflict'> {
  const r = await new sql.Request(tx)
    .input('sCoArt', sql.Char(30), row.coArt).input('sCoPrecio', sql.Char(6), row.coPrecio)
    .input('sCoAlma', sql.Char(6), almaParam(row.coAlma))
    .input('sDesdeOri', sql.Char(10), row.desde)
    .input('sDesde', sql.Char(10), set.desde ?? null)
    .input('sHasta', sql.Char(10), set.hasta ?? null)
    .input('bSetHasta', sql.Bit, 'hasta' in set ? 1 : 0)
    .input('deMonto', sql.Decimal(18, 5), set.monto ?? null)
    .input('tsValidador', sql.Binary, hexToBuffer(row.validador))
    .input('sCoUsMo', sql.Char(6), user.slice(0, 6))
    .execute('pApiActualizarPrecioArticulo');
  return r.recordset?.[0]?.updated === 1 ? 'success' : 'conflict';
}

export interface PlannedApply { coPrecio: string; coArt: string; coAlma: string; coMone: string | null; user: string; expectedCurrent?: number | null; today?: string }

/** Generic locked read → plan → execute transaction shared by every rate writer (regular changes, promotions). */
export async function applyPlannedErp(
  pool: ConnectionPool,
  a: PlannedApply,
  plan: (rows: RateRow[]) => RatePlan,
): Promise<ApplyOutcome> {
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const rows = await readRowsTx(tx, a);
    if (!matchesExpectedCurrent(rows, a.today ?? todayIso(), a.expectedCurrent)) { await tx.rollback(); return { outcome: 'conflict' }; }
    const planned = plan(rows);
    if (!planned.ok) { await tx.rollback(); return { outcome: 'rejected', message: planned.error }; }
    if (planned.skipped) { await tx.rollback(); return { outcome: 'skipped' }; }
    for (const op of planned.ops) {
      if (op.type === 'insert') {
        await insertRowTx(tx, { coArt: a.coArt, coPrecio: a.coPrecio, coAlma: a.coAlma, desde: op.desde, hasta: op.hasta, monto: op.monto, coMone: a.coMone, user: a.user });
      } else if ((await updateRowTx(tx, op.row, op.set, a.user)) === 'conflict') {
        await tx.rollback();
        return { outcome: 'conflict' };
      }
    }
    await tx.commit();
    return { outcome: 'success' };
  } catch (error) {
    try { await tx.rollback(); } catch { /* already rolled back */ }
    throw error;
  }
}

export async function applyRatePeriodErp(
  pool: ConnectionPool,
  a: { coPrecio: string; coArt: string; coAlma: string; coMone: string | null; from: string; to: string | null; monto: number; today: string; user: string; expectedCurrent?: number | null },
): Promise<ApplyOutcome> {
  return applyPlannedErp(pool, a, rows => planRatePeriod(rows, { from: a.from, to: a.to, monto: a.monto, today: a.today }));
}

export async function createListErp(pool: ConnectionPool, p: { coPrecio: string; desPrecio: string; user: string }): Promise<void> {
  await pool.request()
    .input('sCoPrecio', sql.Char(6), p.coPrecio).input('sDesPrecio', sql.VarChar(60), p.desPrecio)
    .input('sCoUsIn', sql.Char(6), p.user.slice(0, 6))
    .execute('pApiInsertarTipoPrecio');
}

export async function updateListErp(pool: ConnectionPool, p: { coPrecio: string; desPrecio: string; validador: string; user: string }): Promise<'success' | 'conflict'> {
  const r = await pool.request()
    .input('sCoPrecio', sql.Char(6), p.coPrecio).input('sDesPrecio', sql.VarChar(60), p.desPrecio)
    .input('tsValidador', sql.Binary, hexToBuffer(p.validador)).input('sCoUsMo', sql.Char(6), p.user.slice(0, 6))
    .execute('pApiActualizarTipoPrecio');
  return r.recordset?.[0]?.updated === 1 ? 'success' : 'conflict';
}

export async function cloneListErp(
  pool: ConnectionPool,
  p: { coPrecio: string; desPrecio: string; coMone: string | null; from: string; rows: { coArt: string; coAlma: string; monto: number }[]; user: string },
): Promise<void> {
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx)
      .input('sCoPrecio', sql.Char(6), p.coPrecio).input('sDesPrecio', sql.VarChar(60), p.desPrecio)
      .input('sCoUsIn', sql.Char(6), p.user.slice(0, 6))
      .execute('pApiInsertarTipoPrecio');
    for (const r of p.rows) {
      await insertRowTx(tx, { coArt: r.coArt, coPrecio: p.coPrecio, coAlma: r.coAlma, desde: p.from, hasta: null, monto: r.monto, coMone: p.coMone, user: p.user });
    }
    await tx.commit();
  } catch (error) {
    try { await tx.rollback(); } catch { /* already rolled back */ }
    throw error;
  }
}
