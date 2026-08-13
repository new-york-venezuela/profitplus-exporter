# SP: pSeleccionarFactLoteGen
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`stgFactLoteGen`](../tables/stgFactLoteGen.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarColor
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarFactLoteGen] ( @sCo_Fact_Lote_Gen CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            stgFactLoteGen
        WHERE
            Co_Fact_Lote_Gen = @sCo_Fact_Lote_Gen
    END
```
