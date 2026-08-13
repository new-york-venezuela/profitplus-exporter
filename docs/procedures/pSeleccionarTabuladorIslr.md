# SP: pSeleccionarTabuladorIslr
**Tipo**: Seleccionar
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saTabuladorIslr`](../tables/saTabuladorIslr.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarTabuladorIslr
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarTabuladorIslr] ( @sCo_Tab CHAR(20) )
AS 
    BEGIN 

        SELECT
            *
        FROM
            saTabuladorIslr
        WHERE
            co_tab = @sCo_Tab	
	
    END
```
