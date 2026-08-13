# SP: pSeleccionarTipoComprobante
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saTipoComprobante`](../tables/saTipoComprobante.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			pSeleccionarTipoComprobante
DESCRIPCION:	Selecciona un registro de la tabla saTipoComprobante segun su primaryKey
CREADO POR:		SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarTipoComprobante] ( @sCo_Tipo CHAR(2) )
AS 
    BEGIN

        SELECT
            *
        FROM
            saTipoComprobante
        WHERE
           co_tipo = @sCo_Tipo
    END
```
