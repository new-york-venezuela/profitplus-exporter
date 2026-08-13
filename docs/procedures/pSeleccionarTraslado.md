# SP: pSeleccionarTraslado
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saTraslado`](../tables/saTraslado.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarTraslado
DESCRIPCION: Busca el traslado segun el numero del mismo
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarTraslado] ( @sTras_Num CHAR(20) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saTraslado
        WHERE
            tras_num = @sTras_Num
    END
```
