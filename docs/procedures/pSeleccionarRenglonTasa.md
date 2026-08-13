# SP: pSeleccionarRenglonTasa
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saTasa`](../tables/saTasa.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		:	pSeleccionarRenglonTasa
DESCRIPCION	:	Procedimiento para seleccionar todos los tasas asociados a una moneda
CREADO POR	:	SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarRenglonTasa] ( @sCo_Mone CHAR(6) )
AS 
    BEGIN

        SELECT
            *, 0 AS RENG_NUM
        FROM
            saTasa
        WHERE
            Co_Mone = @sCo_Mone
        ORDER BY
            Fecha DESC
	
    END
```
