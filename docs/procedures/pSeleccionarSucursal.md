# SP: pSeleccionarSucursal
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saSucursal`](../tables/saSucursal.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarSucursal
DESCRIPCION: Seleccion de un registro de la tabla  almacen
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarSucursal] ( @sCo_Sucur CHAR(6) )
AS 
    BEGIN

        SELECT
            *
        FROM
            saSucursal
        WHERE
            co_sucur = @sCo_Sucur

    END
```
