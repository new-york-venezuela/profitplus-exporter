# SP: pSeleccionarDescuentoArticulo
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saDescArticulo`](../tables/saDescArticulo.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarDescuentoArticulo
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS.
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarDescuentoArticulo] ( @sCo_Desc CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            [saDescArticulo]
        WHERE
            co_desc = @sCo_Desc
    END
```
