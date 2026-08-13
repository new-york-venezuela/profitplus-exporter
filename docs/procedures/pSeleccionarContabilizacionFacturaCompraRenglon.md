# SP: pSeleccionarContabilizacionFacturaCompraRenglon
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saCatArticulo`](../tables/saCatArticulo.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saFacturaCompraRengExt`](../tables/saFacturaCompraRengExt.md)
- [`saLineaArticulo`](../tables/saLineaArticulo.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <10/09/2010>
-- Last Update: 2017-08-03
-- Description:	<pSeleccionarContabilizacionFacturaCompraRenglon>
-- =============================================
CREATE PROCEDURE [dbo].[pSeleccionarContabilizacionFacturaCompraRenglon]
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
	 
            SELECT    FV.doc_num AS Co_Doc_Padre, FVR.reng_num AS Co_Doc, CASE WHEN FV.fec_emis > FV.fec_reg THEN FV.fec_emis ELSE FV.fec_reg END as fec_Emis, MO.relacion AS mone_relacion, CL.co_prov AS Co_Auxiliar, CL.prov_des AS Descrip_Auxiliar, 
                      FVR.co_sucu_in AS Co_Sucu_Cont, FVR.co_art, FVR.des_art, FVR.co_alma, FVR.total_art, FVR.stotal_art, FVR.co_uni, FVR.sco_uni, FVR.cost_unit, FVR.porc_desc, 
                      FVR.monto_desc, FVR.tipo_imp, FVR.tipo_imp2, FVR.tipo_imp3, FVR.porc_imp, FVR.porc_imp2, FVR.porc_imp3, FVR.monto_imp, FVR.monto_imp2, FVR.monto_imp3, 
                      FVR.reng_neto, FVR.pendiente, FVR.tipo_doc, FVR.num_doc, FVR.rowguid_doc, FVR.total_dev, FVR.monto_dev, FVR.otros, FVR.comentario, FVR.lote_asignado, 
                      FVR.dis_cen AS dis_cen_saFacturaCompraRenglon, FVR.co_us_in, FVR.co_sucu_in, FVR.fe_us_in, FVR.co_us_mo, FVR.co_sucu_mo, FVR.fe_us_mo, FVR.revisado, 
                      FVR.trasnfe, FVR.rowguid, FVR.pendiente2, FVR.cost_unit_om, AR.dis_cen AS dis_cen_saArticulo, FV.co_mone, CL.prov_des AS des_proveedor, 
                      CL.co_prov AS Co_proveedor, FV.tasa, LI.dis_cen AS dis_cen_saLineaArticulo, CA.dis_cen AS dis_cen_saCatArticulo,isnull(rx.sin_der_cre_fis,0) as sin_der_cre_fis,rx.credito_fiscal, FV.nro_fact AS nro_fact
			FROM      dbo.saFacturaCompraReng AS FVR INNER JOIN
                      dbo.saFacturaCompra AS FV ON FVR.doc_num = FV.doc_num INNER JOIN
                      dbo.saMoneda AS MO ON FV.co_mone = MO.co_mone LEFT OUTER JOIN
                      dbo.saProveedor AS CL ON FV.co_prov = CL.co_prov INNER JOIN
                      dbo.saArticulo AS AR ON FVR.co_art = AR.co_art INNER JOIN
                      dbo.saLineaArticulo AS LI ON AR.co_lin = LI.co_lin INNER JOIN
                      dbo.saCatArticulo AS CA ON AR.co_cat = CA.co_cat
```
