# SP: pSeleccionarCondicionPago
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCondicionPago`](../tables/saCondicionPago.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarCondicionPago
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarCondicionPago] ( @sCo_Cond CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saCondicionPago
        WHERE
            co_cond = @sCo_Cond
    END
```
