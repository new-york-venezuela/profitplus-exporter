# SP: pCostoActualizarEntradaDCLITodos
**Tipo**: Procedimiento
**Módulo**: Inventario

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pCostoActualizarEntradaDCLITodos]
AS 
    BEGIN

        DECLARE @TipoCosto CHAR(1)

        SELECT  @TipoCosto = i_costo_inventario  FROM par_emp

		DECLARE @Tipo_DocOrigenDe AS CHAR(5)  = isnull((select cast(value AS char(5)) from sys.extended_properties where NAME = 'DCLIR'),'DCLIl')
        DECLARE Cursor_Origen CURSOR LOCAL FAST_FORWARD
        FOR
            SELECT
                R.rowguid
            FROM
                saDevolucionClienteReng R
                INNER JOIN saDevolucionCliente E ON e.doc_num = R.doc_num
				INNER JOIN saArticulo ART ON R.co_art = ART.co_art and ART.ANULADO = 0 
            WHERE
                e.anulado = 0
            ORDER BY
                E.fec_emis ASC, E.fec_reg ASC

        DECLARE @RowGuid AS UNIQUEIDENTIFIER

        OPEN Cursor_Origen
        FETCH NEXT FROM Cursor_Origen INTO @RowGuid

        WHILE @@FETCH_STATUS = 0 
            BEGIN
                EXEC [dbo].[pCostoActualizarEntradaDCLI] @RowGuid_Doc_Orig = @RowGuid, @TipoCosto = @TipoCosto, @Tipo_DocOrigenDe=@Tipo_DocOrigenDe
                FETCH NEXT FROM Cursor_Origen INTO @RowGuid
            END

        CLOSE Cursor_Origen
        DEALLOCATE Cursor_Origen

    END
```
