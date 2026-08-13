# SP: pSeleccionarUnidadTributaria
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saUnidadTributaria`](../tables/saUnidadTributaria.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarUnidadTributaria
DESCRIPCION: Dado el año de la unidad tributaria, selecciona los datos del mismo
CREADO POR: SOFTECH SISTEMAS
FECHA MODIFICACIÓN: <2020-02-18>
***************************************************************************************************************/
CREATE Procedure [dbo].[pSeleccionarUnidadTributaria]
	(
		@sdCo_Fec smalldatetime
	)
AS
BEGIN
	SELECT *
	FROM dbo.saUnidadTributaria WHERE Co_Fec = @sdCo_Fec
END
```
