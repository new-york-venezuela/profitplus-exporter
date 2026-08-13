# SP: pSeleccionarUnidad
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saUnidad`](../tables/saUnidad.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarUnidad
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarUnidad] ( @sCo_Uni CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saUnidad
        WHERE
            co_uni = @sCo_Uni
    END
```
