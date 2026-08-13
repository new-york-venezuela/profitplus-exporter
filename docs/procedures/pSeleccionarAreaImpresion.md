# SP: pSeleccionarAreaImpresion
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saAreaImpresion`](../tables/saAreaImpresion.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pSeleccionarAreaImpresion
*DESCRIPCIÓN	:
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarAreaImpresion] ( @sCo_Area_Imp CHAR(3) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saAreaImpresion
        WHERE
            co_area_imp = @sCo_Area_Imp
    END
```
