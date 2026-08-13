# SP: pSeleccionarColor
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saColor`](../tables/saColor.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarColor
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarColor] ( @sCo_Color CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saColor
        WHERE
            co_color = @sCo_Color
    END
```
