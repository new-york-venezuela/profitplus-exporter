# SP: pv_ObtenerProxSerieNumAlfa
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`saSerie`](../tables/saSerie.md)
- [`saSerieTipo`](../tables/saSerieTipo.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pv_SeleccionarNumeroControl
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ObtenerProxSerieNumAlfa] 
	(
		@Co_Serie CHAR(20)
	)
AS
BEGIN
	SELECT 
		SA.co_serie,
		dbo.ProximoAlfanumerico(ISNULL(SA.prox_a,' ')) AS prox_a,
		ISNULL(SA.prox_n,0)+1 AS prox_n,
		TI.prefijo AS prefijo, 
		TI.sufijo AS sufijo,
		TI.longitud AS longitud
	FROM 
		saSerie SA INNER JOIN saSerieTipo TI ON
		SA.co_tipo_serie = TI.co_tipo_serie
	WHERE
		co_serie = @Co_Serie
END
```
