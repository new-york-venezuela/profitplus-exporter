# SP: pSeleccionarComisionPrecioArticulo
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saComisionPrecioArticulo`](../tables/saComisionPrecioArticulo.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarComisionPrecioArticulo
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarComisionPrecioArticulo] ( @sCo_Comip CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saComisionPrecioArticulo
        WHERE
            co_comip = @sCo_Comip
	
    END
```
