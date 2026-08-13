# SP: pSeleccionarDescuentoLinea
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saDescLinea`](../tables/saDescLinea.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarDescuentoLinea
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarDescuentoLinea] ( @sCo_Desc CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saDescLinea
        WHERE
            co_desc = @sCo_Desc		
    END
```
