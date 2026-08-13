# SP: pSeleccionarIntegracion
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saIntegr`](../tables/saIntegr.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarIntegracion
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarIntegracion] ( @iInte_Num INT )
AS 
    BEGIN
        SELECT
            *
        FROM
            saIntegr
        WHERE
            inte_num = @iInte_Num
    END
```
