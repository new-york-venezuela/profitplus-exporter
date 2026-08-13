# SP: pSeleccionarRegla
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saReglaInt`](../tables/saReglaInt.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarRegla
DESCRIPCION: Selecciona una regla de integración
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarRegla] ( @sCo_Reg CHAR(10) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saReglaInt
        WHERE
            co_reg = @sCo_Reg
    END
```
