# SP: RepStockArticulosxFecha
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCatArticulo`](../tables/saCatArticulo.md)
- [`saLineaArticulo`](../tables/saLineaArticulo.md)
- [`saProcedencia`](../tables/saProcedencia.md)
- [`saSubLinea`](../tables/saSubLinea.md)
- [`saUnidad`](../tables/saUnidad.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS
 Create date:	<05-03-10>
 Description:	<Articulos con su Stock>
 =============================================*/
CREATE PROCEDURE [dbo].[RepStockArticulosxFecha]
	-- Add the parameters for the stored procedure here
    @sCo_Codigo_d CHAR(30) = NULL ,
    @sCo_Codigo_h CHAR(30) = NULL ,
    @sCo_Linea_d CHAR(6) = NULL ,
    @sCo_Linea_h CHAR(6) = NULL ,
    @sCo_Categoria_d CHAR(6) = NULL ,
    @sCo_Categoria_h CHAR(6) = NULL ,
    @sCo_SubLinea_d CHAR(6) = NULL ,
    @sCo_SubLinea_h CHAR(6) = NULL ,
    @sCo_Procedencia_d CHAR(6) = NULL ,
    @sCo_Procedencia_h CHAR(6) = NULL ,
	@sCo_NivelStock CHAR(4) = NULL ,
	@sTipoStock CHAR(4) = NULL ,
    @dCo_fecha DATETIME = NULL ,
    @sCo_Alma CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        DECLARE @bObtenerUnidadPrincipal BIT ;


		IF (@sTipoStock in ('SCOM', 'SLLE', 'SDES', 'SDIS'))   
        BEGIN
			RAISERROR('Reporte no disponible para el tipo de stock seleccionado.', 16,1)
			RETURN
		END

---------------Valores por Defecto-------------------
        IF ( @sDir IS NULL ) 
            SET @sDir = 'ASC'

        IF ( @sCampOrderBy IS NULL ) 
            SET @sCampOrderBy = 'co_art'

        IF @sTipoStock IS NULL 
            SET @sTipoStock = 'ACT'               
                                  
        IF @sCo_NivelStock IS NULL 
            SET @sCo_NivelStock = 'TODO' 

		IF (@sTipoStock not like 'S%') 
            SET @bObtenerUnidadPrincipal = 1
       ELSE 
            SET @bObtenerUnidadPrincipal = 0
--------------Fin Valores por Defecto----------------

		IF (@dCo_fecha is not null)
		Begin
			SET @dCo_fecha = dbo.fechasimple(@dCo_fecha)
			SET @dCo_fecha = DATEADD(d,1,@dCo_fecha)
			SET @dCo_fecha = DATEADD(mi,-1,@dCo_fecha)
		ENd

		SELECT * FROM
		(
		 SELECT
			D.lin_des, E.subl_des, T.cat_des, P.des_proc,
			@sTipoStock AS TipoStock,
			'co_uni' = CASE WHEN @bObtenerUnidadPrincipal = 1 THEN AUP.co_uni ELSE AUS.Co_Uni END,
			'des_uni' = CASE WHEN @bObtenerUnidadPrincipal = 1 THEN UP.des_uni ELSE US.des_Uni END,
			Case 
			when @sTipoStock = 'COM' THEN
			[dbo].[ConsultarStockComprometidoxAlmacenxFecha](A.co_Art, @sCo_Alma, @dCo_fecha, null)
			when @sTipoStock = 'LLE' THEN
			[dbo].[ConsultarStockPorLl
```
