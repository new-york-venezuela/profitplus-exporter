# SP: pSeleccionarZona
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saZona`](../tables/saZona.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarZona
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarZona] ( @sCo_Zon CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saZona
        WHERE
            co_Zon = @sCo_Zon
    END
```
