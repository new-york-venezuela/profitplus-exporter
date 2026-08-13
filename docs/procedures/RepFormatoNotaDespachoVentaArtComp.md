# SP: RepFormatoNotaDespachoVentaArtComp
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtCompuesto`](../tables/saArtCompuesto.md)
- [`saArtCompuestoReng`](../tables/saArtCompuestoReng.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saNotaDespachoVenta`](../tables/saNotaDespachoVenta.md)
- [`saNotaDespachoVentaReng`](../tables/saNotaDespachoVentaReng.md)
- [`saTransporte`](../tables/saTransporte.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <04/12/2017>
-- Description:	<Reporte de Formato Nota de Despacho Venta Articulo Compuesto>
-- =============================================
CREATE PROCEDURE [dbo].[RepFormatoNotaDespachoVentaArtComp] 
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
            ART.modelo, CL.cli_des, CL.rif, CL.nit, CL.telefonos, CL.fax, CL.direc1,
            (CASE WHEN (NDV.dir_ent IS NOT NULL AND LEN(LTRIM(NDV.dir_ent)) > 0) THEN NDV.dir_ent ELSE CL.dir_ent2 END) AS dir_Despacho, 
            VE.ven_des, TR.des_tran, CP.cond_des, MO.mone_des,
		/*Campos saNotaDespachoVenta*/ NDV.doc_num, NDV.co_cli, NDV.co_tran, NDV.co_mone, NDV.co_ven, NDV.co_cond,
            NDV.descrip,NDV.fec_emis, NDV.fec_venc, NDV.fec_reg, NDV.anulado, NDV.status, NDV.n_control, NDV.tasa,
            NDV.porc_desc_glob, NDV.monto_desc_glob, NDV.porc_reca, NDV.monto_reca, NDV.total_bruto, NDV.monto_imp,
            NDV.monto_imp2, NDV.monto_imp3, NDV.otros1, NDV.otros2, NDV.otros3, NDV.total_neto, NDV.saldo, NDV.dir_ent,
            NDV.comentario, NDV.contrib, NDV.seriales_s, NDV.salestax,
            NDV.impfis, NDV.impfisfac, 
		/*Campos saNotaDespachoVentaReng*/ NDVR.reng_num, NDVR.co_art AS co_art, NDVR.des_art, NDVR.co_alma, NDVR.total_art,
            NDVR.stotal_art, NDVR.co_uni, NDVR.sco_uni, NDVR.co_precio, NDVR.prec_vta, NDVR.prec_vta_om, NDVR.porc_desc,
            NDVR.monto_desc, NDVR.tipo_imp, NDVR.tipo_imp2, NDVR.tipo_imp3, NDVR.porc_imp, NDVR.porc_imp2, NDVR.porc_imp3,
            NDVR.monto_imp, NDVR.monto_imp2, NDVR.monto_imp3, NDVR.reng_neto, NDVR.pendiente, NDVR.pendiente2, 
			(CASE WHEN NDVR.tipo_doc IS NULL THEN 'NDES' ELSE NDVR.tipo_doc END) AS tipo_doc,
            NDVR.num_doc, NDVR.rowguid_doc, NDVR.total_dev, NDVR.monto_dev, NDVR.otros, NDVR.comentario, NDVR.lote_asignado, 
			ART.art_des, 
		/*Campos saArtCompuesto y saArtCompuestoReng*/
			0 as kreng_num
        FROM
            saNotaDespachoVenta AS NDV
            INNER JOIN saNotaDespachoVentaReng AS NDVR ON NDVR.doc_num = NDV.doc_num
            INNER JOI
```
