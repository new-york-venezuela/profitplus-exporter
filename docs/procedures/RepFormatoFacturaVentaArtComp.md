# SP: RepFormatoFacturaVentaArtComp
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtCompuesto`](../tables/saArtCompuesto.md)
- [`saArtCompuestoReng`](../tables/saArtCompuestoReng.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saSucursal`](../tables/saSucursal.md)
- [`saTransporte`](../tables/saTransporte.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <16/11/2017>
-- Last date Update <2019-10-07>
-- Description:	<Reporte de Formato Factura Venta Articulo Compuesto>
-- =============================================
CREATE PROCEDURE [dbo].[RepFormatoFacturaVentaArtComp] 
	-- Add the parameters for the stored procedure here
    @cCo_Numero_d CHAR(20) = NULL ,
    @cCo_Numero_h CHAR(20) = NULL ,
    @cCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

-- Este select trae la información para el renglon del articulo compuesto
		 SELECT  
            ART.modelo, CL.cli_des, CL.rif, CL.nit, CL.telefonos, CL.fax, CL.direc1,SUCU.sucur_des as co_sucu_in,
            (CASE WHEN (FV.dir_ent IS NOT NULL AND LEN(LTRIM(FV.dir_ent)) > 0) THEN FV.dir_ent ELSE CL.dir_ent2 END) AS dir_entrega, 
            VE.ven_des, TR.des_tran, CP.cond_des, MO.mone_des,
		/*Campos saFacturaVenta*/ FV.doc_num, FV.co_cli, FV.co_tran, FV.co_mone, FV.co_ven, FV.co_cond,
            FV.descrip,FV.fec_emis, FV.fec_venc, FV.fec_reg, FV.anulado, FV.status, FV.n_control, FV.tasa,
            FV.porc_desc_glob, FV.monto_desc_glob, FV.porc_reca, FV.monto_reca, FV.total_bruto, FV.monto_imp,
            FV.monto_imp2, FV.monto_imp3, FV.otros1, FV.otros2, FV.otros3, FV.total_neto, FV.saldo, FV.dir_ent,
            FV.comentario, FV.contrib, FV.seriales_s, FV.salestax,
            FV.impfis, FV.impfisfac, 
		/*Campos saFacturaVentaReng*/ FVR.reng_num, FVR.co_art AS co_art, FVR.des_art, FVR.co_alma, FVR.total_art,
            FVR.stotal_art, FVR.co_uni, FVR.sco_uni, FVR.co_precio, FVR.prec_vta, FVR.prec_vta_om, FVR.porc_desc,
            FVR.monto_desc, FVR.tipo_imp, FVR.tipo_imp2, FVR.tipo_imp3, FVR.porc_imp, FVR.porc_imp2, FVR.porc_imp3,
            FVR.monto_imp, FVR.monto_imp2, FVR.monto_imp3, FVR.reng_neto, FVR.pendiente, FVR.pendiente2, 
			(CASE WHEN FVR.tipo_doc IS NULL THEN 'FACT' ELSE FVR.tipo_doc END) AS tipo_doc,
            FVR.num_doc, FVR.rowguid_doc, FVR.total_dev, FVR.monto_dev, FVR.otros, FVR.comentario, FVR.lote_asignado, 
			ART.art_des, 
		/*Campos saArtCompuesto y saArtCompuestoReng*/
			0 as kreng_num
        FROM
            saFacturaVenta AS FV
            INNER JOIN saFacturaVentaReng AS FVR ON FVR.doc_num = FV.doc_num
            INNER JOIN saCliente AS CL ON CL.co_cli = FV.co_cli
```
