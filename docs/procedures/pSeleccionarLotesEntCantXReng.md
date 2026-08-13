# SP: pSeleccionarLotesEntCantXReng
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saLoteEntrada`](../tables/saLoteEntrada.md)

## Código (excerpt)
```sql
-- =================================================================================
-- Author:		SOFTECH SISTEMAS
-- Create date: 20/10/2014
-- Description:	SP que indica si algun renglon en el documento padre posee lotes
-- =================================================================================

CREATE PROCEDURE [dbo].[pSeleccionarLotesEntCantXReng]
    @sTipo_Doc CHAR(4) ,
    @gRowguid UNIQUEIDENTIFIER = NULL
AS 
    BEGIN
        SELECT
            ISNULL(COUNT(*), 0) AS cantidad
        FROM
            saLoteEntrada
        WHERE

            tipo_doc = @sTipo_Doc
            AND rowguid_reng = @gRowguid 
    END
```
