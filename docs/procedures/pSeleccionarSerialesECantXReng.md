# SP: pSeleccionarSerialesECantXReng
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saSeriales`](../tables/saSeriales.md)

## Código (excerpt)
```sql
-- =================================================================================
-- Author:		SOFTECH SISTEMAS
-- Create date: 19/05/2010
-- Description:	SP que indica si algun renglon en el documento padre posee seriales
-- =================================================================================

CREATE PROCEDURE [pSeleccionarSerialesECantXReng]
    @sTipo_Doc CHAR(4) ,
    @gRowguid UNIQUEIDENTIFIER = NULL
AS 
    BEGIN
        SELECT
            ISNULL(COUNT(*), 0) AS cantidad
        FROM
            saSeriales
        WHERE
            doc_tip_e = @sTipo_Doc
            AND doc_num_e = @gRowguid --and
		  --doc_num_s is null
    END
```
