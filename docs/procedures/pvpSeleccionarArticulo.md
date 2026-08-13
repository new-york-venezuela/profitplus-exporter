# SP: pvpSeleccionarArticulo
**Tipo**: Punto de Venta
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pvpSeleccionarArticulo
DESCRIPCION: Buscar artículos de acuerdo a los parámetros de entrada
FECHA CREACIÓN : <2020-10-06>
CREADO POR: SOFTECH SISTEMAS.
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pvpSeleccionarArticulo] (
 @sCo_Art CHAR(30) = NULL,
 @sArt_des VARCHAR(120) = NULL

 )
AS 
    BEGIN
	DECLARE @sArt_desTmp VARCHAR(500)

	SET NOCOUNT ON;

	SET @sArt_desTmp = '%' + @sArt_des + '%'
		
        SELECT
            *
        FROM
            saArticulo
        WHERE 1=1 
		AND (@sCo_Art IS NULL OR co_art = @sCo_Art)
		AND (@sArt_des IS NULL OR art_des LIKE @sArt_desTmp)
  
    END
```
