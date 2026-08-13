# SP: RepStockArticulosxLoteFecVec
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAlmacen`](../tables/saAlmacen.md)
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saLoteEntrada`](../tables/saLoteEntrada.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS
 Create date:   <04-04-11>
 Description:	<Articulos con su Stock por Lote>
 =============================================*/
CREATE PROCEDURE [RepStockArticulosxLoteFecVec]
	-- Add the parameters for the stored procedure here
    @sCo_Codigo_d CHAR(30) = NULL ,
    @sCo_Codigo_h CHAR(30) = NULL ,
    @sCo_Descripcion_d CHAR(120) = NULL ,
    @sCo_Descripcion_h CHAR(120) = NULL ,
    @sCo_Linea_d CHAR(6) = NULL ,
    @sCo_Linea_h CHAR(6) = NULL ,
    @sCo_Categoria_d CHAR(6) = NULL ,
    @sCo_Categoria_h CHAR(6) = NULL ,
    @sCo_SubLinea_d CHAR(6) = NULL ,
    @sCo_SubLinea_h CHAR(6) = NULL ,
    @sCo_Almacen_d CHAR(6) = NULL ,
    @sCo_Almacen_h CHAR(6) = NULL ,
    @sCo_Fecha_d DATETIME = NULL ,
    @sCo_Fecha_h DATETIME = NULL ,
    @sTipo_Unidad CHAR(4) = NULL , -- (Si es primaria o secundaria)
    @sCo_Uni CHAR(6) = NULL ,
    @sTipoStock CHAR(4) = NULL ,
    @sCo_NivelStock CHAR(4) = NULL ,
    @sCo_NumeroLote_d CHAR(20) = NULL ,
    @sCo_NumeroLote_h CHAR(20) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
        DECLARE @bObtenerUnidadPrincipal BIT ;

---------------Valores por Defecto-------------------
        IF ( @sDir IS NULL ) 
            SET @sDir = 'ASC'

        IF ( @sCampOrderBy IS NULL ) 
            SET @sCampOrderBy = 'co_alma'

                         
        IF @sCo_NivelStock IS NULL 
            SET @sCo_NivelStock = 'DIFE' 
--------------Fin Valores por Defecto----------------


        SET @sCo_fecha_d = dbo.fechasimple(@sCo_fecha_d)
        SET @sCo_fecha_h = dbo.fechasimple(@sCo_fecha_h)

        SELECT TOP 10000
            A.*, LE.numero_lote, Le.fecha_expiracion, AL.co_alma, AL.des_alma, '' AS TipoStock, AU.co_uni AS co_unidad,
            dbo.ConsultarStockActualxAlmacenxFechaxLote(A.co_art, NULL, @sCo_Fecha_h, NULL, NULL, LE.numero_lote) AS StockActual
        FROM
            saArticulo AS A
            LEFT JOIN saLoteEntrada AS LE ON A.co_art = LE.co_art --AND A.tipo <> 'S' --AND A.maneja_lote = '1'
            LEFT JOIN saAlmacen AS AL ON AL.co_alma = LE.co_alma
            INNER JOIN saArtUnidad AS AU ON AU.co_art = A.co_art
                                            AND AU.uni_principal = 1
        WHERE
            ( ( @sCo_Codigo_d IS NULL
```
