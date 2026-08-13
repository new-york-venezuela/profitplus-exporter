# SP: RepNotaEntregaVentaxArt2
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saNotaEntregaVenta`](../tables/saNotaEntregaVenta.md)
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <25/08/2010>
-- Description:	<Reporte de Nota de Entrega de Venta por Artículos 2>
-- =============================================
CREATE PROCEDURE [dbo].[RepNotaEntregaVentaxArt2] 
	-- Add the parameters for the stored procedure here
    @cCo_Articulo_d CHAR(30) = NULL ,
    @cCo_Articulo_h CHAR(30) = NULL ,
    @dCo_fecha_d SMALLDATETIME = NULL ,
    @dCo_fecha_h SMALLDATETIME = NULL ,
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
    @cCo_Almacen_d CHAR(6) = NULL ,
    @cCo_Almacen_h CHAR(6) = NULL ,
    @cCo_Transporte_d CHAR(6) = NULL ,
    @cCo_Transporte_h CHAR(6) = NULL ,
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
	
        IF @dCo_fecha_d IS NOT NULL 
            SET @dCo_fecha_d = dbo.FechaSimple(@dCo_fecha_d)
        IF @dCo_fecha_h IS NOT NULL 
            SET @dCo_fecha_h = dbo.FechaSimple(@dCo_fecha_h)

-- Insert statements for procedure here

-------------------------------
        IF ( @cStatus IS NULL ) 
            SET @cStatus = 'TODO'
        IF ( @cAnulado IS NULL ) 
            SET @cAnulado = 'TODO'
-------------------------------

        SELECT
            Filtro_anulado, tip_rep, co_cli, co_ven, fec_emis, anulado, reng_num, doc_num, co_art, co_uni, co_alma,
            prec_vta, iva, total_art, otros, monto_base, art_des, modelo, ROUND(( monto_base + iva + otros ), 2) AS neto
        FROM
            ( SELECT
                @cAnulado AS Filtro_anulado, 'venta' AS tip_rep, FV.co_cli, FV.co_ven, FV.fec_emis, FV.anulado,
                FVR.reng_num, FVR.doc_num, FVR.co_art, FVR.co_uni, FVR.co_alma, FVR.monto_desc, FVR.monto_desc_glob,
                FVR.monto_reca_glob, FVR.prec_vta, ROUND(( FVR.monto_imp + FVR.monto_imp_afec_glob ), 2) AS iva,
        /*ROUND((dbo.ArtUnidadBase(FVR.co_art,FVR.co_uni,FVR.total_art)) * (CASE WHEN FC.anulado = 1 THEN 0
```
