# SP: pSeleccionarLote
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saLoteEntrada`](../tables/saLoteEntrada.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarLote
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarLote] ( @gRowGuid_Reng uniqueidentifier )
AS 
    BEGIN
        SELECT
            *
        FROM
            saLoteEntrada
        WHERE
            RowGuid_Reng = @gRowGuid_Reng
    END
```
