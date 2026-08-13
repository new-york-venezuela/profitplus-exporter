# SP: RepFormatoDevolucionClienteSNT
**Tipo**: Reporte
**Módulo**: Ventas

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saAdiCampo`](../tables/saAdiCampo.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saDocumentoVentaInfoIGTF`](../tables/saDocumentoVentaInfoIGTF.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saTransporte`](../tables/saTransporte.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			RepFormatoDevolucionPuntoDeVenta
DESCRIPCION:	OBTIENE LAS DEVOLUCIONES CON IGTF (para homologacion Seniat)
CREADO POR:		SOFTECH SISTEMAS
CREATE DATE:    2025-02-13
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[RepFormatoDevolucionClienteSNT] 
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
        SET @Tipo_doc = 'devoventa' ;
		
		declare @DirFis as nvarchar(254)
		declare @Telef as nvarchar(254)
		declare @MonedaBase as char(6)

		select @DirFis=val_str from saAdiCampo where co_adicampo = 'dir_fis'
		select @Telef=val_str from saAdiCampo where co_adicampo ='telef'
		select @MonedaBase=g_moneda from par_emp 

        SELECT
            @Tipo_doc AS TIPO_DOC, 'tipo' = 1, ART.modelo, CL.cli_des, CL.rif, CL.nit, CL.telefonos, CL.fax, CL.direc1,
            (CASE WHEN (FV.dir_ent IS NOT NULL AND len(ltrim(FV.dir_ent)) > 0) THEN FV.dir_ent ELSE CL.dir_ent2 END) AS dir_entrega,
            VE.ven_des, TR.des_tran, CP.cond_des, MO.mone_des,
		/*Campos saFacturaVenta*/ FV.doc_num, FV.descrip, FV.co_cli, FV.co_tran, FV.co_mone, FV.co_ven, FV.co_cond,
            FV.fec_emis, FV.fec_venc, FV.fec_reg, FV.anulado, FV.status, FV.n_control, FV.ven_ter, FV.tasa,
            FV.porc_desc_glob, FV.monto_desc_glob, FV.porc_reca, FV.monto_reca, FV.total_bruto, FV.monto_imp,
            FV.monto_imp2, FV.monto_imp3, 
			CASE WHEN (ISNULL(DVI.base_imponible,0) > 0 ) THEN 0.00 ELSE FV.otros1 END AS otros1, 
			FV.otros2, FV.otros3, FV.total_neto, FV.saldo, FV.dir_ent,
            FV.comentario, FV.dis_cen, FV.feccom, FV.numcom, FV.contrib, FV.impresa, FV.seriales_e, FV.salestax,
            FV.impfis, FV.impfisfac, FV.campo1, FV.campo2, FV.campo3, FV.campo4, FV.campo5, FV.campo6, FV.campo7,
            FV.campo8, FV.co_us_in, FV.co_sucu_in, FV.fe_us_in, FV.co_us_mo, FV.co_sucu_mo, FV.fe_us_mo, FV.revisado,
            FV.trasnfe, FV.validador, FV.rowguid,
		/*Campos saFacturaVentaReng*/ FVR.reng_num, FV
```
