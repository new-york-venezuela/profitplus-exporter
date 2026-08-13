# SP: pEliminarSerialesEntradaRenglon
**Tipo**: Eliminar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saSeriales`](../tables/saSeriales.md)

## Código (excerpt)
```sql
/******************************************************************
*NOMBRE			:	[pEliminarSerialesEntradaRenglon]
*DESCRIPCIÓN	:	Elimina un registro en la tabla  seriales
*AUTOR			:	SOFTECH SISTEMAS
******************************************************************/

CREATE PROCEDURE [pEliminarSerialesEntradaRenglon]
    (
      @sTipo_Doc CHAR(4) ,
      @gRowguid UNIQUEIDENTIFIER = NULL -- Id del reglon que representa la entrada del serial

    )
AS 
    BEGIN
		--DECLARE @TableTimestamp TABLE (rowguid uniqueidentifier)
        DECLARE @iCantidadRenglones INT
        DECLARE @MensajeError VARCHAR(256)
		
        DECLARE @TranCounter INT ;
        SET @TranCounter = @@TRANCOUNT ;
        IF @TranCounter > 0
			-- Procedure called when there is an active transaction. Create a savepoint to be able to roll back only the work done in the procedure if there is an error.
            SAVE TRANSACTION TransacStock ;
        ELSE
			-- Procedure must start its own transaction.
            BEGIN TRANSACTION TransacStock ;

        DELETE FROM
            saSeriales
			--OUTPUT deleted.rowguid  INTO @TableTimestamp
        WHERE
            doc_num_e = @gRowguid
            AND doc_tip_e = @sTipo_Doc
            AND doc_num_s IS NULL

		-- Valido que no queden seriales con salidad
        SELECT
            @iCantidadRenglones = ISNULL(COUNT(*), 0)
        FROM
            saSeriales
        WHERE
            doc_num_e = @gRowguid
            AND doc_tip_e = @sTipo_Doc

        IF @iCantidadRenglones = 0 
            BEGIN
                IF @TranCounter = 0 
                    COMMIT TRANSACTION TransacStock
            END
        ELSE 
            BEGIN
                IF @TranCounter = 0 
                    ROLLBACK TRANSACTION TransacStock
                ELSE 
                    IF XACT_STATE() <> -1
                -- If the transaction is still valid, just roll back to the savepoint set at the start of the stored procedure.
                        ROLLBACK TRANSACTION TransacStock ;

                SET @MensajeError = 'El renglon posee seriales de entrada a los cuales se le ha dado salida.'
                RAISERROR(@MensajeError,16,1)
                RETURN ;
            END
    END
```
