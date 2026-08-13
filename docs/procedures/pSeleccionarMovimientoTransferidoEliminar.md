# SP: pSeleccionarMovimientoTransferidoEliminar
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
/**********************************************************************************************
*NOMBRE			:	pSeleccionarMovimientoTransferidoEliminar
*DESCRIPCION	:	Obtiene si una movimiento de caja fue tranferido para eliminarlo
*AUTOR			:	SOFTECH SISTEMAS
*FECHA			:	06/08/2010
**********************************************************************************************/
CREATE PROCEDURE [pSeleccionarMovimientoTransferidoEliminar] ( @sMov_Num CHAR(20) )
AS 
    BEGIN

        SELECT
            mov_num
        FROM
            saMovimientoCaja
        WHERE
            mov_nro = @sMov_Num
            AND tipo_mov = 'E'

    END
```
