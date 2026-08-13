# SP: pSeleccionarContabilizacionAjusteRenglon
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjuste`](../tables/saAjuste.md)
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCatArticulo`](../tables/saCatArticulo.md)
- [`saLineaArticulo`](../tables/saLineaArticulo.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saTipoAjuste`](../tables/saTipoAjuste.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pSeleccionarContabilizacionAjusteRenglon]
    (
      @sCo_Doc_Padre CHAR(20) = NULL ,
      @sdFechaDesde DATETIME ,
      @sdFechHasta DATETIME ,
      @sCo_Sucu_Desde CHAR(6) = NULL ,
      @sCo_Sucu_Hasta CHAR(6) = NULL ,
      @bDocnoint BIT --,--Documentos no Contabilizados
		--@IRengNum Int
	
    )
AS 
    BEGIN
        IF @sdFechaDesde IS NOT NULL 
            SET @sdFechaDesde = dbo.FechaSimple(@sdFechaDesde)
        IF @sdFechHasta IS NOT NULL 
            SET @sdFechHasta = dbo.FechaSimple(@sdFechHasta)
        SELECT     AJR.ajue_num AS Co_Doc_Padre, AJR.reng_num AS Co_Doc, AJ.fecha AS Fec_Emis, AJR.co_tipo, AJR.co_art, AJR.co_alma, AJR.co_uni, AJR.sco_uni, 
                      AJR.dis_cen AS dis_cen_saAjusteReng, AJR.total_art, '' AS Co_Auxiliar, '' AS Descrip_Auxiliar, AJR.stotal_art, AJR.cost_unit, AJR.lote_asignado, AJR.costo_adi1, 
                      AJR.co_sucu_in AS Co_Sucu_Cont, AJR.costo_adi2, AJR.costo_adi3, AJR.rowguid, AJR.co_tipo AS Expr1, AJR.co_us_in, AJR.co_sucu_in, AJR.fe_us_in, AJR.co_us_mo,
                       AJR.co_sucu_mo, AJR.fe_us_mo, AJ.co_mone, AJ.tasa, MO.mone_des, TA.des_tipo, TA.tipo_trans AS TipoAjuste, MO.relacion AS mone_relacion, 
                      AR.dis_cen AS dis_cen_saArticulo, li.dis_cen AS dis_cen_saLineaArticulo, ca.dis_cen AS dis_cen_saCatArticulo
		FROM         dbo.saAjusteReng AS AJR INNER JOIN
                      dbo.saAjuste AS AJ ON AJR.ajue_num = AJ.ajue_num INNER JOIN
                      dbo.saMoneda AS MO ON AJ.co_mone = MO.co_mone INNER JOIN
                      dbo.saTipoAjuste AS TA ON AJR.co_tipo = TA.co_tipo INNER JOIN
                      dbo.saArticulo AS AR ON AJR.co_art = AR.co_art INNER JOIN
                      dbo.saLineaArticulo AS li ON AR.co_lin = li.co_lin INNER JOIN
                      dbo.saCatArticulo AS ca ON AR.co_cat = ca.co_cat
        WHERE
             AJR.ajue_num = @sCo_Doc_Padre
        ORDER BY
            Fec_Emis ASC, Co_Doc ASC
    END
```
