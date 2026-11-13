import sql from 'mssql';
import type { CostLayer } from './fifo';

// Zero-cost layers (stock added by an adjustment with no cost reference) are skipped on purpose: an unpriced
// layer must surface as "Sin datos" (hasData: false once none are left), never as free stock.
export async function getCostLayers(pool: sql.ConnectionPool, coArt: string): Promise<CostLayer[]> {
  const result = await pool.request()
    .input('coArt', sql.Char(30), coArt)
    .query(`
      SELECT CHE.cantidad, CHE.cantidad_usada, CHE.costo
      FROM saCostoHistoricoEntrada CHE
      JOIN saArticulo A ON A.rowguid = CHE.cod_articulo_rowguid
      WHERE A.co_art = @coArt AND (CHE.cantidad - CHE.cantidad_usada) > 0
        AND CHE.costo > 0
      ORDER BY CHE.fecha_emision ASC
    `);

  return result.recordset.map(row => ({
    remaining: Number(row.cantidad) - Number(row.cantidad_usada),
    costBsd:   Number(row.costo),
  }));
}
