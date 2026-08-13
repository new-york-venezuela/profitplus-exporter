# SP: pSeleccionarComisionPrecioLinea
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saComisionPrecioLinea`](../tables/saComisionPrecioLinea.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarComisionPrecioLinea
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarComisionPrecioLinea] ( @sCo_Comip CHAR(6) )
AS 
    BEGIN

        SELECT
            *
        FROM
            saComisionPrecioLinea
        WHERE
            co_comip = @sCo_Comip
	
    END
```
