# SP: pv_ObtenerConsecutivoXSerie
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`saConsecutivo`](../tables/saConsecutivo.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			pv_ObtenerConsecutivoXSerie
DESCRIPCION:	OBTIENE EL CODIGO DE CONSECUTIVO MANEJADO POR UNA SERIE EN ESPECIFICO  
CREADO POR:		SOFTECH SISTEMAS
***************************************************************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ObtenerConsecutivoXSerie]
( 
	@sCo_Serie			CHAR(20), 
	@sCo_consecutivo	CHAR (16)
)
AS 
  BEGIN
		DECLARE @sql NVARCHAR(512)

		SET @sql = N'SELECT co_consecutivo
   								FROM saconsecutivo
   								WHERE co_serie = RTRIM(@sCo_Serie) AND co_consecutivo LIKE ' + '''' + RTRIM(@sCo_consecutivo) + '%'''
   								
   		EXEC sp_executesql @query = @sql, @params = N'@sCo_Serie CHAR (20)', @sCo_Serie = @sCo_Serie
			
    END
```
