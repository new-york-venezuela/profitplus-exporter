# SP: pCostoActualizarEntradaGCOMTodos
**Tipo**: Procedimiento
**Módulo**: Inventario

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saArtCompuestoGen`](../tables/saArtCompuestoGen.md)
- [`saArticulo`](../tables/saArticulo.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pCostoActualizarEntradaGCOMTodos]
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
                E.rowguid
            FROM
                saArtCompuestoGen E 
				INNER JOIN saArticulo ART ON E.co_art = ART.co_art and ART.ANULADO = 0 -- KC
            WHERE
                E.gene_art = 1
			Order by E.fecha


        DECLARE @RowGuid AS UNIQUEIDENTIFIER

        DECLARE @IdCorrida UNIQUEIDENTIFIER
        DECLARE @HoraCorrida DATETIME
        DECLARE @PistaMensaje AS VARCHAR(MAX)
		
		SET @IdCorrida = NEWID()

		SET @HoraCorrida = GETDATE()
		SET @PistaMensaje = 'Iniciando proceso actualiza entrada - Generacion de Compuesto'
        EXEC [pInsertarPista] @sUsuario_Id = 'N/A', @dtFecha = @HoraCorrida, @sCo_Sucu = 'N/A',
            @sTablaOri = 'CostoActGCOM', @rowguidOri = @IdCorrida, @sTipo_Op = N'I', @sMaquina = 'N/A',
            @sCampos = @PistaMensaje

        OPEN Cursor_Origen
        FETCH NEXT FROM Cursor_Origen INTO @RowGuid

        WHILE @@FETCH_STATUS = 0 
            BEGIN
				SET @HoraCorrida = GETDATE()
				SET @PistaMensaje = 'Actualizar Compuesto [' + CAST(@RowGuid AS VARCHAR(64))  + ']'
				EXEC [pInsertarPista] @sUsuario_Id = 'N/A', @dtFecha = @HoraCorrida, @sCo_Sucu = 'N/A',
				@sTablaOri = 'CostoActGCOM', @rowguidOri = @IdCorrida, @sTipo_Op = N'I', @sMaquina = 'N/A',
				@sCampos = @PistaMensaje

                EXEC [dbo].[pCostoActualizarEntradaGCOM] @RowGuid_Doc_Orig = @RowGuid, @TipoCosto = @TipoCosto
                FETCH NEXT FROM Cursor_Origen INTO @RowGuid
            END

        CLOSE Cursor_Origen
        DEALLOCATE Cursor_Origen

		SET @HoraCorrida = GETDATE()
        SET @PistaMensaje = 'Fin proceso actualiza entrada - Generacion de Compuesto'
        EXEC [pInsertarPista] @sUsuario_Id = 'N/A', @dtFecha = @HoraCorrida, @sCo_Sucu = 'N/A',
            @sTablaOri = 'CostoActGCOM', @rowguidOri = @IdCorrida, @sTipo_Op = N'I', @sMaquina = 'N/A',
            @sCampos = @PistaMensaje


    END
```
