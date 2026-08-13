# SP: pSeleccionarTransporte
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saTransporte`](../tables/saTransporte.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarTransporte
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarTransporte] ( @sCo_Tran CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saTransporte
        WHERE
            co_tran = @sCo_Tran
    END
```
