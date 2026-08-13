# SP: pSeleccionarStatusDeposito
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarStatusDeposito
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarStatusDeposito] ( @sCodCaja CHAR(20) )
AS 
    BEGIN
        SELECT
            depositado
        FROM
            saMovimientoCaja
        WHERE
            mov_num = @sCodCaja
    END
```
