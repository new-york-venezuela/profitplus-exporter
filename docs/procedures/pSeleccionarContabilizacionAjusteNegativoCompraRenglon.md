# SP: pSeleccionarContabilizacionAjusteNegativoCompraRenglon
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saCatArticulo`](../tables/saCatArticulo.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saDocumentoCompraReng`](../tables/saDocumentoCompraReng.md)
- [`saLineaArticulo`](../tables/saLineaArticulo.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		pSeleccionarContabilizacionAjusteNegativoCompraRenglon
DESCRIPCION	:Selecciona los documentos de ajuste negativo en compras por renglon no contabilizados
CREADO POR	:SOFTECH SISTEMAS
CREADO EL	:2019/11/21
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarContabilizacionAjusteNegativoCompraRenglon]
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
	 
		SELECT     DV.nro_doc AS Co_Doc_Padre, DVR.reng_num AS Co_Doc, DVR.co_tipo_doc, DV.fec_emis, MO.relacion AS mone_relacion, CL.co_prov AS Co_Auxiliar, CL.prov_des AS Descrip_Auxiliar, 
                      DVR.co_sucu_in AS Co_Sucu_Cont, DVR.co_art, DVR.des_art, DVR.co_alma, DVR.total_art, DVR.cost_unit, DVR.porc_desc, DVR.monto_desc, DVR.tipo_imp, 
                      DVR.tipo_imp2, DVR.tipo_imp3, DVR.porc_imp, DVR.porc_imp2, DVR.porc_imp3, DVR.monto_imp, DVR.monto_imp2, DVR.monto_imp3, DVR.reng_neto, 
                      DVR.co_tipo_doc AS Expr1, DVR.nro_doc, DVR.rowguid, DVR.otros, DVR.dis_cen AS dis_cen_saDocumentoCompraReng, DVR.co_us_in, DVR.co_sucu_in, 
                      DVR.co_us_mo, DVR.co_sucu_mo, DVR.revisado, DVR.rowguid AS Expr2, DVR.cost_unit_om, AR.dis_cen AS dis_cen_saArticulo, DV.co_mone, 
                      CL.prov_des AS des_proveedor, CL.co_prov AS Co_proveedor, DV.tasa, li.dis_cen AS dis_cen_saLineaArticulo, ca.dis_cen AS dis_cen_saCatArticulo
		FROM         dbo.saArticulo AS AR INNER JOIN
                      dbo.saLineaArticulo AS li ON AR.co_lin = li.co_lin INNER JOIN
                      dbo.saCatArticulo AS ca ON AR.co_cat = ca.co_cat RIGHT OUTER JOIN
                      dbo.saDocumentoCompraReng AS DVR LEFT OUTER JOIN
                      dbo.saDocumentoCompra AS DV ON DVR.nro_doc = DV.nro_doc AND DVR.co_tipo_doc = DV.co_tipo_doc INNER JOIN
                      dbo.saMoneda AS MO ON DV.co_mone = MO.co_mone LE
```
