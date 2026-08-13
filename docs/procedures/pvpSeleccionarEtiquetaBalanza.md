# SP: pvpSeleccionarEtiquetaBalanza
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvEtiquetaBalanza`](../tables/pvEtiquetaBalanza.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pvpSeleccionarEtiquetaBalanza
*DESCRIPCIÓN	: Selecciona una Etiqueta para Balanza según el código
*AUTOR			: SOFTECH SISTEMAS
***************************************************************************/ 

CREATE PROCEDURE [dbo].[pvpSeleccionarEtiquetaBalanza] ( @sCo_Etiqueta CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            pvEtiquetaBalanza
        WHERE
            co_Etiqueta = @sCo_Etiqueta
    END
```
