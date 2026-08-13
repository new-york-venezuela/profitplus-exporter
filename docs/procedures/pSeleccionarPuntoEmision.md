# SP: pSeleccionarPuntoEmision
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saPuntoEmision`](../tables/saPuntoEmision.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pSeleccionarPuntoEmision
*DESCRIPCIÓN	:
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarPuntoEmision] ( @sCo_Punto_Emi CHAR(3) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saPuntoEmision
        WHERE
            co_punto_emi = @sCo_Punto_Emi
    END
```
