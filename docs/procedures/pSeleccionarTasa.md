# SP: pSeleccionarTasa
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saTasa`](../tables/saTasa.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarTasa
DESCRIPCION: Selecciona las tasas de una moneda
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarTasa] ( @sCo_Mone CHAR(6) )
AS 
    BEGIN

        SELECT
            *
        FROM
            saTasa
        WHERE
            co_mone = @sCo_Mone
        ORDER BY
            fecha DESC

    END
```
