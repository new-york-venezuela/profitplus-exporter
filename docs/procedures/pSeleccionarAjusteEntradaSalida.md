# SP: pSeleccionarAjusteEntradaSalida
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjuste`](../tables/saAjuste.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarAjuste
DESCRIPCION: Selecciona los campos contenidos en la tabla  saAjuste
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarAjusteEntradaSalida] ( @sAjue_Num CHAR(20) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saAjuste
        WHERE
            ajue_num = @sAjue_Num
    END
```
