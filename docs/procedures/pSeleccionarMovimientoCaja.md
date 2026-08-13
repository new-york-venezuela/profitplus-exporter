# SP: pSeleccionarMovimientoCaja
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarMovimientoCaja
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarMovimientoCaja] ( @sMov_Num CHAR(20) )
AS 
    BEGIN

        SELECT
            *, ABS(monto_d - monto_h) AS monto
        FROM
            saMovimientoCaja
        WHERE
            mov_num = @sMov_Num
  
    END
```
