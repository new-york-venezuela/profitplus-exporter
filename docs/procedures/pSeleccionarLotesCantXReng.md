# SP: pSeleccionarLotesCantXReng
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saLoteSalida`](../tables/saLoteSalida.md)

## Código (excerpt)
```sql
-- =================================================================================
-- Author:		SOFTECH SISTEMAS
-- Create date: 20/10/2014
-- Description:	SP que indica si algun renglon en el documento padre posee lotes
-- =================================================================================

CREATE PROCEDURE [dbo].[pSeleccionarLotesCantXReng]
    @sTipo_Doc CHAR(4) ,
    @gRowguid UNIQUEIDENTIFIER = NULL
AS 
    BEGIN
        SELECT
            ISNULL(COUNT(*), 0) AS cantidad
        FROM
            saLoteSalida
        WHERE

            tipo_doc = @sTipo_Doc
            AND rowguid_reng = @gRowguid 
    END
```
