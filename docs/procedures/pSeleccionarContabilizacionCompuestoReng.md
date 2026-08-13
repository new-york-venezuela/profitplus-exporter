# SP: pSeleccionarContabilizacionCompuestoReng
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtCompuestoGen`](../tables/saArtCompuestoGen.md)
- [`saArtCompuestoGenReng`](../tables/saArtCompuestoGenReng.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saMoneda`](../tables/saMoneda.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pSeleccionarContabilizacionCompuestoReng]
    (
      @sCo_Doc_Padre CHAR(20) = NULL ,
      @sdFechaDesde SMALLDATETIME ,
      @sdFechHasta SMALLDATETIME ,
      @sCo_Sucu_Desde CHAR(6) = NULL ,
      @sCo_Sucu_Hasta CHAR(6) = NULL ,
      @bDocnoint BIT --Documentos no Contabilizados
	
    )
AS 
    BEGIN
        IF @sdFechaDesde IS NOT NULL 
            SET @sdFechaDesde = dbo.FechaSimple(@sdFechaDesde)
        IF @sdFechHasta IS NOT NULL 
            SET @sdFechHasta = dbo.FechaSimple(@sdFechHasta)
        SELECT
            GC.gene_num AS Co_Doc_Padre, GCR.gene_num AS Co_Doc, GC.fecha AS Fec_Emis, '' AS Co_Auxiliar,
            '' AS Descrip_Auxiliar, GCR.co_sucu_in AS Co_Sucu_Cont,
            [dbo].[TasaAUnaFecha](GC.co_mone, 1, GC.fecha) AS tasa, GCR.dis_cen AS dis_cen_sa_ArtCompuestoGenReng,
            GCR.co_art, GCR.co_alma, GCR.co_uni, GCR.total_art, GCR.lote_asignado, GCR.sco_uni, GCR.stotal_art,
            GCR.cost_unit, GCR.cost_unit_om, GCR.dis_cen AS dis_cen_sa_Art_CompuestoGen, GCR.co_us_in, GCR.fe_us_in,
            GCR.co_us_mo, GCR.co_sucu_mo, GCR.fe_us_mo, GCR.revisado, GCR.trasnfe, GCR.rowguid, MO.mone_des,
            MO.relacion AS mone_relacion, AR.dis_cen AS dis_cen_saArticulo
        FROM
            saArtCompuestoGenReng AS GCR
            LEFT JOIN saArticulo AS AR ON GCR.co_art = AR.co_art
            INNER JOIN saArtCompuestoGen AS GC ON GCR.gene_num = GC.gene_num
            INNER JOIN saMoneda AS MO ON GC.co_mone = MO.co_mone
        WHERE
            GCR.gene_num = @sCo_Doc_Padre
        ORDER BY
            Fec_Emis ASC, Co_Doc ASC
    END
```
