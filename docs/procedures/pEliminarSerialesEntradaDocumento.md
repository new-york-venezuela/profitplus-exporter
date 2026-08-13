# SP: pEliminarSerialesEntradaDocumento
**Tipo**: Eliminar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjuste`](../tables/saAjuste.md)
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saSeriales`](../tables/saSeriales.md)
- [`saTipoAjuste`](../tables/saTipoAjuste.md)

## Código (excerpt)
```sql
/******************************************************************
*NOMBRE			:	[pEliminarSerialesEntradaDocumento]
*DESCRIPCIÓN	:	Elimina un registro en la tabla  seriales
*AUTOR			:	SOFTECH SISTEMAS
******************************************************************/

CREATE PROCEDURE [pEliminarSerialesEntradaDocumento]
    (
      @sTipo_Doc CHAR(4) ,
      @gRowguid UNIQUEIDENTIFIER = NULL -- Id del documento que representa la entrada del serial

    )
AS 
    BEGIN
        DECLARE @iCantidadRenglones INT
        DECLARE @MensajeError VARCHAR(256)
        DECLARE @RowIdsHijo TABLE
            (
              [ROWGUID] [uniqueidentifier]
            )		


        DECLARE @TranCounter INT ;
        SET @TranCounter = @@TRANCOUNT ;
        IF @TranCounter > 0
			-- Procedure called when there is an active transaction. 
			-- Create a savepoint to be able to roll back only the 
			-- work done in the procedure if there is an error.
            SAVE TRANSACTION TransacStock ;
        ELSE
			-- Procedure must start its own transaction.
            BEGIN TRANSACTION TransacStock ;

        IF ( ( @sTipo_Doc = 'AJUS' )
             OR ( @sTipo_Doc = 'COMP' )
             OR ( @sTipo_Doc = 'NREC' )
             OR ( @sTipo_Doc = 'DCLI' )
           )  -- AJUSTE O FACTURA DE COMPRA ó NOTA RECEPCION ó Dev. cliente
            BEGIN
                INSERT  INTO @RowIdsHijo
                        SELECT
                            R.rowguid
                        FROM
                            saAjuste E
                            INNER JOIN saAjusteReng R ON R.ajue_num = E.ajue_num
                            INNER JOIN saTipoAjuste T ON R.co_tipo = T.co_tipo
                        WHERE
                            E.rowguid = @gRowguid
                            AND t.tipo_trans = 0
            END

        DELETE FROM
            saSeriales
        WHERE
            doc_num_e IN ( SELECT
                            [ROWGUID]
                           FROM
                            @RowIdsHijo )
            AND doc_tip_e = @sTipo_Doc
            AND doc_num_s IS NULL

		-- Valido que no queden seriales con salidad
        SELECT
            @iCantidadRenglones = ISNULL(COUNT(*), 0)
        FROM
            saSeriales
        WHERE
            doc_num_e IN ( SELECT
                            [ROWGUID]
                           FROM
                            @RowIdsHijo )
```
