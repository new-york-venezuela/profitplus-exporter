# SP: pEliminarRenglonesDocPago
**Tipo**: Eliminar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saPagoDocReng`](../tables/saPagoDocReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pEliminarOrdenPago
DESCRIPCION	: Elimina un registro de la tabla saPagoDocReng
CREADO POR	: SOFTECH SISTEMAS
MODIFICADO	: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pEliminarRenglonesDocPago]
    (
      @sCob_NumOri CHAR(20) ,
      @iReng_NumOri INT ,
      @sCo_Us_Mo CHAR(6) ,
      @sMaquina VARCHAR(60) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @gRowguid UNIQUEIDENTIFIER = NULL
    )
AS 
    BEGIN
		
        DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER
            )
        DECLARE @nro_doc CHAR(20)
        DECLARE @co_tipo_doc CHAR(20)

        SELECT
            @nro_doc = nro_doc, @co_tipo_doc = co_tipo_doc
        FROM
            saPagoDocReng
        WHERE
            Cob_num = @sCob_numOri
            AND reng_num = @iReng_NumOri

        DELETE FROM
            saPagoDocReng
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            Cob_num = @sCob_numOri
            AND reng_num = @iReng_NumOri	
		
	--Se eliminan los documentos generados por el pago
        DELETE FROM
            saDocumentoCompra
        WHERE
            doc_orig = 'PAGO'
            AND nro_doc = @nro_doc
            and co_tipo_doc = @co_tipo_doc
		
        DECLARE @dtFe_De DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_De = GETDATE(), @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        IF @dtFe_De IS NOT NULL 
            BEGIN
		-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_De, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saPagoDocReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCob_numOri
            END

    END
```
