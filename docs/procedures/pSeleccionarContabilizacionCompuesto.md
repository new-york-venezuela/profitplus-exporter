# SP: pSeleccionarContabilizacionCompuesto
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtCompuestoGen`](../tables/saArtCompuestoGen.md)
- [`saArtCompuestoGenReng`](../tables/saArtCompuestoGenReng.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCatArticulo`](../tables/saCatArticulo.md)
- [`saLineaArticulo`](../tables/saLineaArticulo.md)
- [`saMoneda`](../tables/saMoneda.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pSeleccionarContabilizacionCompuesto]
    (
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
		SELECT     GC.gene_num AS Co_Doc, GC.fecha as Fec_emis, GC.co_sucu_in AS Co_Sucu_Cont, '' AS Co_Auxiliar, '' AS Descrip_Auxiliar, GC.gene_num, GC.co_art, GC.tasa, GC.co_mone, 
                      GC.dis_cen AS dis_cen_saArtCompuestoGen, GC.feccom, GC.numcom, GC.total_art, GC.stotal_art, GC.costo_tot, GC.co_alma, GC.gene_art, GC.seriales_s, GC.campo1, 
                      GC.campo2, GC.campo3, GC.campo4, GC.campo5, GC.campo6, GC.campo7, GC.campo8, GC.co_us_in, GC.co_sucu_in, GC.fe_us_in, GC.co_us_mo, GC.co_sucu_mo, 
                      GC.fe_us_mo, GC.revisado, GC.trasnfe, GC.validador, GC.rowguid, MO.mone_des, MO.relacion AS mone_relacion, ROUND
                          ((SELECT     SUM(cost_unit * total_art) AS Expr1
                              FROM         dbo.saArtCompuestoGenReng AS GCR1
                              WHERE     (GC.gene_num = gene_num)), 2) AS suma_reng_CostoUnitario, ROUND
                          ((SELECT     SUM(cost_unit * total_art) AS Expr1
                              FROM         dbo.saArtCompuestoGenReng AS GCR1
                              WHERE     (GC.gene_num = gene_num)), 2) AS suma_reng_CostoPromedioUnit, AR.dis_cen AS dis_cen_saArticulo, dbo.saCatArticulo.dis_cen as dis_cen_saCatArticulo, 
                      dbo.saLineaArticulo.dis_cen AS dis_cen_saLineaArticulo
		FROM         dbo.saArtCompuestoGen AS GC LEFT OUTER JOIN
                      dbo.saArticulo AS AR ON GC.co_art = AR.co_art INNER JOIN
                      dbo.saMoneda AS MO ON GC.co_mone = MO.co_mone INNER JOIN
                      dbo.saCatArticulo ON AR.co_cat = dbo.saCatArticulo.co_cat INNER JOIN
                      dbo.saLineaArticulo ON AR.co_lin = dbo.saLineaArticulo.co_lin
        WHERE            --(DATEDIFF(DAY, GC.fecha , @sdFechaDesde) <= 0 AND DATEDIFF(DAY, GC.fecha , @sdFechHasta) >= 0)
            ( ( @sdFechaDesde IS NULL
                OR dbo.FechaSimple(GC.fecha) >= @sdFechaDesde
              )
```
