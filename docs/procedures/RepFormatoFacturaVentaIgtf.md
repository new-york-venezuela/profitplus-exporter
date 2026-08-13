# SP: RepFormatoFacturaVentaIgtf
**Tipo**: Reporte
**Módulo**: Ventas

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saDocumentoVentaInfoIGTF`](../tables/saDocumentoVentaInfoIGTF.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saTransporte`](../tables/saTransporte.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: RepFormatoFacturaVentaIgtf
*DESCRIPCIÓN	: Selecciona una devolucion de venta
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/
CREATE PROCEDURE [dbo].[RepFormatoFacturaVentaIgtf] 
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

    -- Insert statements for procedure here
        DECLARE @Tipo_doc CHAR(11) ;
        SET @Tipo_doc = 'factventa' ;
	
       SELECT
            @Tipo_doc AS TIPO_DOC, 'tipo' = 1, ART.modelo, CL.cli_des, CL.rif, CL.nit, CL.telefonos, CL.fax, CL.direc1,
            (CASE WHEN (FV.dir_ent IS NOT NULL AND len(ltrim(FV.dir_ent)) > 0) THEN FV.dir_ent ELSE CL.dir_ent2 END) AS dir_entrega,
            VE.ven_des, TR.des_tran, CP.cond_des, MO.mone_des,
		/*Campos saFacturaVenta*/ FV.doc_num, FV.descrip, FV.co_cli, FV.co_tran, FV.co_mone, FV.co_ven, FV.co_cond,
            FV.fec_emis, FV.fec_venc, FV.fec_reg, FV.anulado, FV.status, FV.n_control, FV.ven_ter, FV.tasa,
            FV.porc_desc_glob, FV.monto_desc_glob / FV.tasa AS monto_desc_glob, FV.porc_reca,
            FV.monto_reca / FV.tasa AS monto_reca, FV.total_bruto / FV.tasa AS total_bruto,
            FV.monto_imp / FV.tasa AS monto_imp, FV.monto_imp2 / FV.tasa AS monto_imp2, FV.monto_imp3,

            CASE WHEN (ISNULL(DVI.base_imponible,0) > 0 ) THEN 0.00 ELSE FV.otros1 / FV.tasa END AS otros1,
			 
			FV.otros2 / FV.tasa AS otros2, FV.otros3 / FV.tasa AS otros3, FV.total_neto,
            FV.saldo, FV.dir_ent, FV.comentario, FV.dis_cen, FV.feccom, FV.numcom, FV.contrib, FV.impresa, FV.seriales_s,
            FV.salestax, FV.impfis, FV.impfisfac, FV.campo1, FV.campo2, FV.campo3, FV.campo4, FV.campo5, FV.campo6,
            FV.campo7, FV.campo8, FV.co_us_in, FV.co_sucu_in, FV.fe_us_in, FV.co_us_mo, FV.co_sucu_mo, FV.fe_us_mo,
            FV.revisado, FV.trasnfe, FV.validador, FV.rowguid,
		/*Campos saFacturaVentaReng*/ FVR.reng_num, FVR.doc_num, FVR.co_art,
            ISNULL(FVR.des_art, ART.art_des) AS des_art,
            FVR.co_alma, FVR.total_art, FVR.stotal_art, FVR.co_uni, FVR.sco_uni, FVR.co_precio,
            FVR.prec_vta / FV.tasa AS prec_vta, FVR.pr
```
