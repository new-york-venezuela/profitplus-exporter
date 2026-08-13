# SP: pSeleccionarAlmacen
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAlmacen`](../tables/saAlmacen.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarSubAlmacen
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarAlmacen] ( @sCo_Alma CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saAlmacen
        WHERE
            co_alma = @sCo_Alma
    END
```
