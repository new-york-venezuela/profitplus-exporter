# SP: RepDevolucionClientexArt
**Tipo**: Reporte
**Módulo**: Ventas

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <25/08/2010>
-- Description:	<Reporte de Devolucion de Clientes por Artículos>
-- =============================================
CREATE PROCEDURE [dbo].[RepDevolucionClientexArt] 
	-- Add the parameters for the stored procedure here
    @cCo_Articulo_d CHAR(30) = NULL ,
    @cCo_Articulo_h CHAR(30) = NULL ,
    @sCo_fecha_d SMALLDATETIME = NULL ,
    @sCo_fecha_h SMALLDATETIME = NULL ,
    @cCo_cliente_d CHAR(16) = NULL ,
    @cCo_cliente_h CHAR(16) = NULL ,
    @cCo_Vendedor_d CHAR(6) = NULL ,
    @cCo_Vendedor_h CHAR(6) = NULL ,
    @cCo_Linea_d CHAR(6) = NULL ,
    @cCo_Linea_h CHAR(6) = NULL ,
    @cCo_SubLinea_d CHAR(6) = NULL ,
    @cCo_SubLinea_h CHAR(6) = NULL ,
    @cCo_Categoria_d CHAR(6) = NULL ,
    @cCo_Categoria_h CHAR(6) = NULL ,
    @cCo_Alamcen_d CHAR(6) = NULL ,
    @cCo_Alamcen_h CHAR(6) = NULL ,
    @cCo_Transporte_d CHAR(6) = NULL ,
    @cCo_Transporte_h CHAR(6) = NULL ,
    @cTipo_origen CHAR(6) = NULL ,
    @cCo_Moneda CHAR(6) = NULL ,
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

        IF ( @cTipo_origen IS NULL
             OR @cTipo_origen = 'TODO'
           ) 
            SET @cTipo_origen = NULL	

        SELECT
            @cAnulado AS Filtro_anulado, ART.art_des, ART.modelo, ART.co_lin, ART.co_subl, ART.co_cat, 
		/*Campos saFacturaVenta*/ FV.doc_num, FV.descrip, FV.co_cli, FV.co_tran, FV.co_mone, FV.co_ven, FV.co_cond,
            FV.fec_emis, FV.fec_venc, FV.fec_reg, FV.anulado, FV.status, FV.n_control, FV.ven_ter, FV.tasa,
            FV.porc_desc_glob, FV.monto_desc_glob, FV.porc_reca, FV.monto_reca, FV.total_bruto, FV.monto_imp,
            FV.monto_imp2, FV.monto_imp3, FV.otros1, FV.otros2, FV.otros3, 
			 FV.total_neto / ( CASE WHEN @cCo_Moneda IS NULL
```
