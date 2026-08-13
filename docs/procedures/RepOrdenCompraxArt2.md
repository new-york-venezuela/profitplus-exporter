# SP: RepOrdenCompraxArt2
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saOrdenCompra`](../tables/saOrdenCompra.md)
- [`saOrdenCompraReng`](../tables/saOrdenCompraReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <25/08/2010>
-- Description:	<Reporte de Ordenes de Compras por Artículos 2>
-- =============================================
CREATE PROCEDURE [RepOrdenCompraxArt2]
    @cCo_Articulo_d CHAR(30) = NULL ,
    @cCo_Articulo_h CHAR(30) = NULL ,
    @dCo_fecha_d SMALLDATETIME = NULL ,
    @dCo_fecha_h SMALLDATETIME = NULL ,
    @cCo_Prov_d CHAR(16) = NULL ,
    @cCo_Prov_h CHAR(16) = NULL ,
    @cCo_Linea_d CHAR(6) = NULL ,
    @cCo_Linea_h CHAR(6) = NULL ,
    @cCo_SubLinea_d CHAR(6) = NULL ,
    @cCo_SubLinea_h CHAR(6) = NULL ,
    @cCo_Categoria_d CHAR(6) = NULL ,
    @cCo_Categoria_h CHAR(6) = NULL ,
    @cCo_Almacen_d CHAR(6) = NULL ,
    @cCo_Almacen_h CHAR(6) = NULL ,
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
            Filtro_anulado, tip_rep, co_prov, fec_emis, anulado, reng_num, doc_num, co_art, co_uni, co_alma, cost_unit,
            iva, total_art, otros, monto_base, art_des, modelo, ROUND(( monto_base + iva + otros ), 2) AS neto
        FROM
            ( SELECT
                @cAnulado AS Filtro_anulado, 'compra' AS tip_rep, FC.co_prov, FC.fec_emis, FC.anulado, FVR.reng_num,
                FVR.doc_num, FVR.co_art, FVR.co_uni, FVR.co_alma, FVR.monto_desc, FVR.monto_desc_glob,
                FVR.monto_reca_glob, FVR.cost_unit, ROUND(( FVR.monto_imp + FVR.monto_imp_afec_glob ), 2) AS iva,
        /*ROUND((dbo.ArtUnidadBase(FVR.co_art,FVR.co_uni,FVR.total_art)) * (CASE WHEN FC.anulado = 1 THEN 0 ELSE 1 END),5)*/
                FVR.total_art, ROUND(( FVR.otros1_glob + FVR.otros2_glob + FVR.otros3_glob ), 2) AS otros,
                ROUND(( ( FVR.cost_unit * FVR.total_art ) - FVR.monto_desc - FVR.monto_desc_glob + FVR.monto_reca_glob ),
```
