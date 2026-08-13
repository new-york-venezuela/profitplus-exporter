# SP: RepCotizacionClientexReng
**Tipo**: Reporte
**Módulo**: Ventas

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saCotizacionCliente`](../tables/saCotizacionCliente.md)
- [`saCotizacionClienteReng`](../tables/saCotizacionClienteReng.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saTransporte`](../tables/saTransporte.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <25/08/2010>
-- Description:	<Reporte de Cotizaciones a Clientes por Renglones>
-- =============================================
CREATE PROCEDURE [RepCotizacionClientexReng] 
	-- Add the parameters for the stored procedure here
    @cCo_Numero_d CHAR(20) = NULL ,
    @cCo_Numero_h CHAR(20) = NULL ,
    @sCo_fecha_d SMALLDATETIME = NULL ,
    @sCo_fecha_h SMALLDATETIME = NULL ,
    @cCo_cliente_d CHAR(16) = NULL ,
    @cCo_cliente_h CHAR(16) = NULL ,
    @cCo_Linea_d CHAR(6) = NULL ,
    @cCo_Linea_h CHAR(6) = NULL ,
    @cCo_SubLinea_d CHAR(6) = NULL ,
    @cCo_SubLinea_h CHAR(6) = NULL ,
    @cCo_Categoria_d CHAR(6) = NULL ,
    @cCo_Categoria_h CHAR(6) = NULL ,
    @cStatus CHAR(6) = NULL ,
    @cAnulado CHAR(6) = NULL ,
    @cCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
	
        IF @sCo_fecha_d IS NOT NULL 
            SET @sCo_fecha_d = dbo.FechaSimple(@sCo_fecha_d)
        IF @sCo_fecha_h IS NOT NULL 
            SET @sCo_fecha_h = dbo.FechaSimple(@sCo_fecha_h)

-- Insert statements for procedure here

-------------------------------
        IF ( @cStatus IS NULL ) 
            SET @cStatus = 'TODO'
        IF ( @cAnulado IS NULL ) 
            SET @cAnulado = 'TODO'
-------------------------------

        SELECT
            @cAnulado AS Filtro_anulado, 'coti' AS tip_rep, ART.art_des, ART.modelo, ART.co_lin, ART.co_subl, ART.co_cat,
            CL.cli_des, VE.ven_des, TR.des_tran, CP.cond_des,		
		/*Campos saFacturaVenta*/ FV.doc_num, FV.descrip, FV.co_cli, FV.co_tran, FV.co_mone, FV.co_ven, FV.co_cond,
            FV.fec_emis, FV.fec_venc, FV.fec_reg, FV.anulado, FV.status, FV.n_control, FV.ven_ter, FV.tasa,
            FV.porc_desc_glob, FV.monto_desc_glob, FV.porc_reca, FV.monto_reca, FV.total_bruto, FV.monto_imp,
            FV.monto_imp2, FV.monto_imp3, FV.otros1, FV.otros2, FV.otros3, FV.total_neto, FV.saldo, FV.dir_ent,
            FV.comentario, FV.dis_cen, FV.feccom, FV.numcom, FV.contrib, FV.impresa, FV.seriales_s, FV.salestax,
            FV.impfis, FV.impfisfac, FV.campo1, FV.campo2, FV.campo3, FV.campo4, FV.campo5, FV.campo6, FV.campo7,
            FV.campo8, FV.co_us_in, FV.co_sucu_in, FV.fe_us_in, FV.co_us_mo, FV.co_sucu_mo, FV.fe_us_mo, FV.revisado,
            FV.trasnfe, FV
```
