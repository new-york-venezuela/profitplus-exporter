import sql from 'mssql';

// Column list (co_art, co_alma, tipo, stock) verified live against sys.columns
// on the dev DB on 2026-08-26: co_alma, co_art, tipo, and stock are the only
// NOT NULL saStockAlmacen columns without a default. revisado and trasnfe are
// nullable. validador is NOT NULL but is a `timestamp` (rowversion) column
// auto-populated by SQL Server and cannot be supplied explicitly. Safe as a
// plain INSERT.
export async function assignArticleToWarehouse(
  pool: sql.ConnectionPool,
  coArt: string,
  coAlma: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const existing = await pool.request()
    .input('coArt', sql.Char(30), coArt)
    .input('coAlma', sql.Char(6), coAlma)
    .query(`SELECT 1 FROM saStockAlmacen WHERE co_art = @coArt AND co_alma = @coAlma AND tipo = 'ACT'`);
  if (existing.recordset.length > 0) {
    return { ok: false, status: 400, error: 'El artículo ya tiene stock registrado en ese almacén' };
  }

  const article = await pool.request()
    .input('coArt', sql.Char(30), coArt)
    .query(`SELECT 1 FROM saArticulo WHERE co_art = @coArt AND anulado = 0`);
  if (article.recordset.length === 0) {
    return { ok: false, status: 404, error: 'Artículo no encontrado' };
  }

  await pool.request()
    .input('coArt', sql.Char(30), coArt)
    .input('coAlma', sql.Char(6), coAlma)
    .query(`INSERT INTO saStockAlmacen (co_art, co_alma, tipo, stock) VALUES (@coArt, @coAlma, 'ACT', 0)`);

  return { ok: true };
}
