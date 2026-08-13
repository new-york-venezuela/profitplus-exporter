# SP: pSeleccionarTipoAjuste
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saTipoAjuste`](../tables/saTipoAjuste.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarTipoAjuste
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarTipoAjuste] ( @sCo_Tipo CHAR(6) )
AS 
    BEGIN

        SELECT
            *
        FROM
            saTipoAjuste
        WHERE
            co_tipo = @sCo_Tipo

    END
```
