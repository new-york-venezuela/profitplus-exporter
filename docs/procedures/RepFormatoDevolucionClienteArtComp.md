# SP: RepFormatoDevolucionClienteArtComp
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtCompuesto`](../tables/saArtCompuesto.md)
- [`saArtCompuestoReng`](../tables/saArtCompuestoReng.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saTransporte`](../tables/saTransporte.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <04/12/2017>
-- Description:	<Reporte de Formato Devolución a Cliente Articulo Compuesto>
-- =============================================
CREATE PROCEDURE [dbo].[RepFormatoDevolucionClienteArtComp] 
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
            (CASE WHEN (DC.dir_ent IS NOT NULL AND LEN(LTRIM(DC.dir_ent)) > 0) THEN DC.dir_ent ELSE CL.dir_ent2 END) AS dir_entrega, 
            VE.ven_des, TR.des_tran, CP.cond_des, MO.mone_des,
		/*Campos saDevolucionCliente*/ DC.doc_num, DC.co_cli, DC.co_tran, DC.co_mone, DC.co_ven, DC.co_cond,
            DC.descrip,DC.fec_emis, DC.fec_venc, DC.fec_reg, DC.anulado, DC.status, DC.n_control, DC.tasa,
            DC.porc_desc_glob, DC.monto_desc_glob, DC.porc_reca, DC.monto_reca, DC.total_bruto, DC.monto_imp,
            DC.monto_imp2, DC.monto_imp3, DC.otros1, DC.otros2, DC.otros3, DC.total_neto, DC.saldo, DC.dir_ent,
            DC.comentario, DC.contrib, DC.salestax,
            DC.impfis, DC.impfisfac, 
		/*Campos saDevolucionClienteReng*/ DCR.reng_num, DCR.co_art AS co_art, DCR.des_art, DCR.co_alma, DCR.total_art,
            DCR.stotal_art, DCR.co_uni, DCR.sco_uni, DCR.co_precio, DCR.prec_vta, DCR.prec_vta_om, DCR.porc_desc,
            DCR.monto_desc, DCR.tipo_imp, DCR.tipo_imp2, DCR.tipo_imp3, DCR.porc_imp, DCR.porc_imp2, DCR.porc_imp3,
            DCR.monto_imp, DCR.monto_imp2, DCR.monto_imp3, DCR.reng_neto, DCR.pendiente, DCR.pendiente2, 
			(CASE WHEN DCR.tipo_doc IS NULL THEN 'DCLI' ELSE DCR.tipo_doc END) AS tipo_doc,
            DCR.num_doc, DCR.rowguid_doc, DCR.total_dev, DCR.monto_dev, DCR.otros, DCR.comentario, DCR.lote_asignado, 
			ART.art_des, 
		/*Campos saArtCompuesto y saArtCompuestoReng*/
			0 as kreng_num
        FROM
            saDevolucionCliente AS DC
            INNER JOIN saDevolucionClienteReng AS DCR ON DCR.doc_num = DC.doc_num
            INNER JOIN saCliente AS CL ON CL.co_cli = DC.co_cli
            INNER JOIN saVendedor AS VE ON VE.co_
```
