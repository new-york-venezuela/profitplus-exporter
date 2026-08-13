# SP: pSeleccionarComisionRentabLinea
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saComisionRentabLinea`](../tables/saComisionRentabLinea.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarComisionRentabLinea
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarComisionRentabLinea] ( @sCo_Comir CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saComisionRentabLinea
        WHERE
            co_comir = @sCo_Comir
    END
```
