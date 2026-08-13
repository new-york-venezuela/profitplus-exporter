# SP: pEliminarRenglonesDocCobro
**Tipo**: Eliminar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCobroDocReng`](../tables/saCobroDocReng.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pEliminarOrdenCobro
DESCRIPCION	: Elimina un registro de la tabla saCobroDocReng
CREADO POR	: SOFTECH SISTEMAS
MODIFICADO	: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pEliminarRenglonesDocCobro]
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
            saCobroDocReng
        WHERE
            Cob_num = @sCob_numOri
            AND reng_num = @iReng_NumOri

        DELETE FROM
            saCobroDocReng
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            Cob_num = @sCob_numOri
            AND reng_num = @iReng_NumOri	
		
	--Se eliminan los documentos generados por el cobro
        DELETE FROM
            saDocumentoVenta
        WHERE
            doc_orig = 'COBRO'
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
                    @sTablaOri = 'saCobroDocReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCob_numOri
            END

    END
```
