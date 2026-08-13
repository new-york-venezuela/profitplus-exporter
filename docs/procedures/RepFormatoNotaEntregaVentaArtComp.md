# SP: RepFormatoNotaEntregaVentaArtComp
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtCompuesto`](../tables/saArtCompuesto.md)
- [`saArtCompuestoReng`](../tables/saArtCompuestoReng.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saNotaEntregaVenta`](../tables/saNotaEntregaVenta.md)
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)
- [`saTransporte`](../tables/saTransporte.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <01/12/2017>
-- Description:	<Reporte de Formato Nota de Entrega Venta Articulo Compuesto>
-- =============================================
CREATE PROCEDURE [dbo].[RepFormatoNotaEntregaVentaArtComp] 
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
            (CASE WHEN (NEV.dir_ent IS NOT NULL AND LEN(LTRIM(NEV.dir_ent)) > 0) THEN NEV.dir_ent ELSE CL.dir_ent2 END) AS dir_entrega, 
            VE.ven_des, TR.des_tran, CP.cond_des, MO.mone_des,
		/*Campos saNotaEntregaVenta*/ NEV.doc_num, NEV.co_cli, NEV.co_tran, NEV.co_mone, NEV.co_ven, NEV.co_cond,
            NEV.descrip,NEV.fec_emis, NEV.fec_venc, NEV.fec_reg, NEV.anulado, NEV.status, NEV.n_control, NEV.tasa,
            NEV.porc_desc_glob, NEV.monto_desc_glob, NEV.porc_reca, NEV.monto_reca, NEV.total_bruto, NEV.monto_imp,
            NEV.monto_imp2, NEV.monto_imp3, NEV.otros1, NEV.otros2, NEV.otros3, NEV.total_neto, NEV.saldo, NEV.dir_ent,
            NEV.comentario, NEV.contrib, NEV.seriales_s, NEV.salestax,
            NEV.impfis, NEV.impfisfac, 
		/*Campos saNotaEntregaVentaReng*/ NEVR.reng_num, NEVR.co_art AS co_art, NEVR.des_art, NEVR.co_alma, NEVR.total_art,
            NEVR.stotal_art, NEVR.co_uni, NEVR.sco_uni, NEVR.co_precio, NEVR.prec_vta, NEVR.prec_vta_om, NEVR.porc_desc,
            NEVR.monto_desc, NEVR.tipo_imp, NEVR.tipo_imp2, NEVR.tipo_imp3, NEVR.porc_imp, NEVR.porc_imp2, NEVR.porc_imp3,
            NEVR.monto_imp, NEVR.monto_imp2, NEVR.monto_imp3, NEVR.reng_neto, NEVR.pendiente, NEVR.pendiente2, 
			(CASE WHEN NEVR.tipo_doc IS NULL THEN 'NENT' ELSE NEVR.tipo_doc END) AS tipo_doc,
            NEVR.num_doc, NEVR.rowguid_doc, NEVR.total_dev, NEVR.monto_dev, NEVR.otros, NEVR.comentario, NEVR.lote_asignado, 
			ART.art_des, 
		/*Campos saArtCompuesto y saArtCompuestoReng*/
			0 as kreng_num
        FROM
            saNotaEntregaVenta AS NEV
            INNER JOIN saNotaEntregaVentaReng AS NEVR ON NEVR.doc_num = NEV.doc_num
            INNER JOIN saCli
```
