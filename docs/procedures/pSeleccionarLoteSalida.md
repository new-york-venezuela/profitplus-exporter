# SP: pSeleccionarLoteSalida
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saLoteSalida`](../tables/saLoteSalida.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarLoteSalida
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarLoteSalida] ( @gRowGuid_Reng uniqueidentifier )
AS 
    BEGIN
        SELECT
            *
        FROM
            saLoteSalida
        WHERE
            RowGuid_Reng = @gRowGuid_Reng
    END
```
