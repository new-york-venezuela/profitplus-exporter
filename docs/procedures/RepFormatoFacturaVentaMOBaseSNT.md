# SP: RepFormatoFacturaVentaMOBaseSNT
**Tipo**: Reporte
**Módulo**: Ventas

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saAdiCampo`](../tables/saAdiCampo.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saDocumentoVentaInfoIGTF`](../tables/saDocumentoVentaInfoIGTF.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaInfoTercero`](../tables/saFacturaVentaInfoTercero.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saNotaEntregaVenta`](../tables/saNotaEntregaVenta.md)
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saTransporte`](../tables/saTransporte.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
-- =============================================
CREATE PROCEDURE [dbo].[RepFormatoFacturaVentaMOBaseSNT] 

	-- Add the parameters for the stored procedure here
    @sCo_Numero_d CHAR(20) = NULL ,
    @sCo_Numero_h CHAR(20) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
       @sMarcarImpreso char(2) = 'NO' ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

    -- Insert statements for procedure here
        DECLARE @Tipo_doc CHAR(11) ;
        SET @Tipo_doc = 'factventa' ;
       
             if (@sMarcarImpreso = 'SI')
             Begin
                    update saFacturaVenta set impresa = 1 
                           where   
                           (            ( @sCo_Numero_d IS NULL OR doc_num >= @sCo_Numero_d)
                                  AND ( @sCo_Numero_h IS NULL OR doc_num <= @sCo_Numero_h))
                   AND ( anulado = 0 )
                           AND ( @sCo_Sucursal IS NULL OR @sCo_Sucursal = co_sucu_in)
             End

		declare @DirFis as nvarchar(254)
		declare @Telef as nvarchar(254)
		declare @MonedaBase as char(6)
		declare @MonedaAdicional as char(6)
		declare @PercepcionIgtf as int

		select @DirFis=val_str from saAdiCampo where co_adicampo = 'dir_fis'
		select @Telef=val_str from saAdiCampo where co_adicampo ='telef'
		select @MonedaBase=g_moneda,@MonedaAdicional=i_moneda_articulo,@PercepcionIgtf=percepcion_igtf from par_emp 

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
            FV.comentario, FV.dis_cen, FV.feccom, FV.numcom, FV.contrib, FV.impresa, FV.seriales_s, F
```
