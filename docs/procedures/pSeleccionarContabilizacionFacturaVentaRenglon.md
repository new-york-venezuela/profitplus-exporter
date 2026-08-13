# SP: pSeleccionarContabilizacionFacturaVentaRenglon
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saCatArticulo`](../tables/saCatArticulo.md)
- [`saCliente`](../tables/saCliente.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saLineaArticulo`](../tables/saLineaArticulo.md)
- [`saMoneda`](../tables/saMoneda.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <10/09/2010>
-- Last Update: 2017-08-03
-- Description:	<pSeleccionarContabilizacionFacturaVentaRenglon>
-- =============================================
CREATE PROCEDURE [dbo].[pSeleccionarContabilizacionFacturaVentaRenglon]
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
	 
SELECT     FV.doc_num AS Co_Doc_Padre, FVR.reng_num AS Co_Doc, CASE WHEN FV.fec_emis > FV.fec_reg THEN FV.fec_emis ELSE FV.fec_reg END as fec_Emis, MO.relacion AS mone_relacion, CL.co_cli AS Co_Auxiliar, CL.cli_des AS Descrip_Auxiliar, 
                      FVR.co_sucu_in AS Co_Sucu_Cont, FVR.co_art, FVR.des_art, FVR.co_alma, FVR.total_art, FVR.stotal_art, FVR.co_uni, FVR.sco_uni, FVR.co_precio, FVR.prec_vta, 
                      FVR.porc_desc, FVR.monto_desc, FVR.tipo_imp, FVR.tipo_imp2, FVR.tipo_imp3, FVR.porc_imp, FVR.porc_imp2, FVR.porc_imp3, FVR.monto_imp, FVR.monto_imp2, 
                      FVR.monto_imp3, FVR.reng_neto, FVR.pendiente, FVR.tipo_doc, FVR.num_doc, FVR.rowguid_doc, FVR.total_dev, FVR.monto_dev, FVR.otros, FVR.comentario, 
                      FVR.lote_asignado, FVR.dis_cen AS dis_cen_saFacturaVentaRenglon, FVR.co_us_in, FVR.co_sucu_in, FVR.fe_us_in, FVR.co_us_mo, FVR.co_sucu_mo, 
                      FVR.fe_us_mo, FVR.revisado, FVR.trasnfe, FVR.rowguid, FVR.pendiente2, FVR.prec_vta_om, AR.dis_cen AS dis_cen_saArticulo, FV.co_mone, 
                      CL.cli_des AS des_cliente, CL.co_cli AS Co_cliente, FV.tasa, CA.dis_cen AS dis_cen_saCatArticulo, LI.dis_cen AS dis_cen_saLineaArticulo
FROM         dbo.saFacturaVentaReng AS FVR INNER JOIN
                      dbo.saFacturaVenta AS FV ON FVR.doc_num = FV.doc_num INNER JOIN
                      dbo.saMoneda AS MO ON FV.co_mone = MO.co_mone LEFT OUTER JOIN
                      dbo.saCliente AS CL ON FV.co_cli = CL.co_cli INNER JOIN
                      dbo.saArticulo AS AR ON FVR.co_art = AR.co_art INNER JOIN
                      dbo.saCatArticulo AS CA ON AR.co_cat = CA.co_cat INNER JOIN
                      dbo.saLineaArticulo AS LI ON AR.co_lin = LI.co_lin
WHERE
	  FVR.doc_num = @sCo_Doc_Padre
        ORDER BY
            Fec_Emis ASC, Co_Doc ASC
    END
```
