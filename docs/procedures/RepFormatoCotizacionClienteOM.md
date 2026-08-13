# SP: RepFormatoCotizacionClienteOM
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saCotizacionCliente`](../tables/saCotizacionCliente.md)
- [`saCotizacionClienteReng`](../tables/saCotizacionClienteReng.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saTransporte`](../tables/saTransporte.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <02/06/2010>
-- Description:	<Reporte de Formato de Cotizacion de Clientes>
-- =============================================
CREATE PROCEDURE [RepFormatoCotizacionClienteOM] 
	-- Add the parameters for the stored procedure here
    @sCo_Numero_d CHAR(20) = NULL ,
    @sCo_Numero_h CHAR(20) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

    -- Insert statements for procedure here
        DECLARE @Tipo_doc CHAR(11) ;
        SET @Tipo_doc = 'cotiventa' ;
	
        SELECT
            @Tipo_doc AS TIPO_DOC, 'tipo' = 1, ART.modelo, CL.cli_des, CL.rif, CL.nit, CL.telefonos, CL.fax, CL.direc1,
            (CASE WHEN (FV.dir_ent IS NOT NULL AND len(ltrim(FV.dir_ent)) > 0) THEN FV.dir_ent ELSE CL.dir_ent2 END) AS dir_entrega,
            VE.ven_des, TR.des_tran, CP.cond_des, MO.mone_des,
		/*Campos saCotizacionCliente*/ FV.doc_num, FV.descrip, FV.co_cli, FV.co_tran, FV.co_mone, FV.co_ven,
            FV.co_cond, FV.fec_emis, FV.fec_venc, FV.fec_reg, FV.anulado, FV.status, FV.n_control, FV.ven_ter, FV.tasa,
            FV.porc_desc_glob, FV.monto_desc_glob / FV.tasa AS monto_desc_glob, FV.porc_reca,
            FV.monto_reca / FV.tasa AS monto_reca, FV.total_bruto / FV.tasa AS total_bruto,
            FV.monto_imp / FV.tasa AS monto_imp, FV.monto_imp2 / FV.tasa AS monto_imp2, FV.monto_imp3,
            FV.otros1 / FV.tasa AS otros1, FV.otros2 / FV.tasa AS otros2, FV.otros3 / FV.tasa AS otros3, FV.total_neto,
            FV.saldo, FV.dir_ent, FV.comentario, FV.dis_cen, FV.feccom, FV.numcom, FV.contrib, FV.impresa, FV.seriales_s,
            FV.salestax, FV.impfis, FV.impfisfac, FV.campo1, FV.campo2, FV.campo3, FV.campo4, FV.campo5, FV.campo6,
            FV.campo7, FV.campo8, FV.co_us_in, FV.co_sucu_in, FV.fe_us_in, FV.co_us_mo, FV.co_sucu_mo, FV.fe_us_mo,
            FV.revisado, FV.trasnfe, FV.validador, FV.rowguid,
		/*Campos saCotizacionClienteReng*/ FVR.reng_num, FVR.doc_num, FVR.co_art,
            CASE WHEN FVR.des_art IS NOT NULL THEN FVR.des_art
                 ELSE ART.art_des
            END AS des_art, FVR.co_alma, FVR.total_art, FVR.stotal_art, FVR.co_uni, FVR.sco_uni, FVR.co_precio,
            FVR.prec_vta / FV.tasa AS prec_vta, FVR.prec_vta_om, FVR.porc_desc, FVR.monto_desc / FV.tasa AS monto
```
