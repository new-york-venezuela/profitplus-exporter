# SP: pSeleccionarLineaArticulo
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saLineaArticulo`](../tables/saLineaArticulo.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarLineaArticulo
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarLineaArticulo] ( @sCo_Lin CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saLineaArticulo
        WHERE
            co_lin = @sCo_Lin
    END
```
