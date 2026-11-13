import sql from 'mssql';
import type { OpenAjusLayer } from './ajuste-cost-repair';

const iso = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);

/** Read-only: every AJUS layer with stock left, with the purchase cost in force on its date. */
export async function listOpenAjusLayers(pool: sql.ConnectionPool): Promise<OpenAjusLayer[]> {
  const r = await pool.request().query(`
    SELECT CONVERT(char(36), C.cod_costo_historico_entrada) AS id,
           RTRIM(A.co_art) AS coArt, RTRIM(A.art_des) AS description,
           C.fecha_emision AS fecha, C.cantidad - C.cantidad_usada AS remaining, C.costo,
           R.costo AS refCosto, R.fecha_emision AS refFecha
    FROM saCostoHistoricoEntrada C
    JOIN saArticulo A ON A.rowguid = C.cod_articulo_rowguid
    OUTER APPLY (
      SELECT TOP 1 P.costo, P.fecha_emision
      FROM saCostoHistoricoEntrada P
      WHERE P.cod_articulo_rowguid = C.cod_articulo_rowguid
        AND P.tipo_doc IN ('COMP', 'PROV') AND P.costo > 0 AND P.fecha_emision <= C.fecha_emision
      ORDER BY P.fecha_emision DESC, P.rengNum ASC
    ) R
    WHERE C.tipo_doc = 'AJUS' AND C.cantidad - C.cantidad_usada > 0
    ORDER BY A.co_art, C.fecha_emision`);
  return r.recordset.map((row: Record<string, unknown>) => ({
    id: String(row.id), coArt: String(row.coArt), description: String(row.description ?? ''),
    fecha: iso(row.fecha as Date) ?? '', remaining: Number(row.remaining), costo: Number(row.costo),
    refCosto: row.refCosto === null ? null : Number(row.refCosto), refFecha: iso(row.refFecha as Date | null),
  }));
}

export async function fixLayerCost(pool: sql.ConnectionPool, runId: string, id: string, costoNew: number): Promise<void> {
  await pool.request()
    .input('sRunId', sql.VarChar(36), runId)
    .input('gCapa', sql.UniqueIdentifier, id)
    .input('deCostoNuevo', sql.Decimal(18, 5), costoNew)
    .execute('pApiCorregirCostoCapaAjuste');
}

export async function restoreRun(pool: sql.ConnectionPool, runId: string): Promise<{ restored: number; skipped: number }> {
  const r = await pool.request().input('sRunId', sql.VarChar(36), runId).execute('pApiRestaurarCostoCapasAjuste');
  const row = r.recordset?.[0] ?? {};
  return { restored: Number(row.restored ?? 0), skipped: Number(row.skipped ?? 0) };
}
