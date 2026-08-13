# SP: pCostoActualizarEntradaTRASTodos
**Tipo**: Procedimiento
**Módulo**: Inventario

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saTraslado`](../tables/saTraslado.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pCostoActualizarEntradaTRASTodos]
AS 
    BEGIN

		 SET NOCOUNT ON

        DECLARE @TipoCosto CHAR(1)

        SELECT
            @TipoCosto = i_costo_inventario
        FROM
            par_emp

        DECLARE Cursor_Origen CURSOR LOCAL FAST_FORWARD
        FOR
            SELECT
                R.rowguid
            FROM
                saTrasladoReng R
                INNER JOIN saTraslado E ON E.tras_num = R.tras_num
				INNER JOIN saArticulo ART ON R.co_art = ART.co_art and ART.ANULADO = 0 
            WHERE
                E.anulado = 0 
			Order by E.fec_sal, E.fecha, R.reng_num


        DECLARE @RowGuid AS UNIQUEIDENTIFIER

        OPEN Cursor_Origen
        FETCH NEXT FROM Cursor_Origen INTO @RowGuid

        WHILE @@FETCH_STATUS = 0 
            BEGIN
                EXEC [dbo].[pCostoActualizarEntradaTRAS] @RowGuid_Doc_Orig = @RowGuid, @TipoCosto = @TipoCosto
                FETCH NEXT FROM Cursor_Origen INTO @RowGuid
            END

        CLOSE Cursor_Origen
        DEALLOCATE Cursor_Origen

    END
```
