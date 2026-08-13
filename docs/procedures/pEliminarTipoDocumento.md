# SP: pEliminarTipoDocumento
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pEliminarTipoDocumento
*DESCRIPCIÓN	: Elimina una configuracion realizada en la tabla saTipoDocumento
*AUTOR			: SOFTECH SISTEMAS.
*************************************************************************/

CREATE PROCEDURE [dbo].[pEliminarTipoDocumento]
    (
      @sCo_Tipo_DocOri CHAR(6) ,
      @tsValidador TIMESTAMP ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCo_Us_Mo CHAR(6) = NULL ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER
            )

        DELETE FROM
            saTipoDocumento
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_tipo_doc = @sCo_Tipo_DocOri
            AND validador = @tsValidador	

--Se elimina el consecutivo actualizado
  
    DECLARE @sNombreConsecutivo VARCHAR(16)
    SET @sNombreConsecutivo = 'DOC_VEN_' + LTRIM(@sCo_Tipo_DocOri)
	EXEC [dbo].[pEliminarConsecutivo] @sNombreConsecutivo, NULL, @sMaquina, @sCo_Us_Mo, @sCo_Sucu_Mo, NULL	 
	
	SET @sNombreConsecutivo = 'DOC_COM_' + LTRIM(@sCo_Tipo_DocOri)
	EXEC [dbo].[pEliminarConsecutivo] @sNombreConsecutivo, NULL, @sMaquina, @sCo_Us_Mo, @sCo_Sucu_Mo, NULL	

--Se elimina el consecutivo actualizado
  
    DECLARE @sNombreConsecutivot VARCHAR(16)
    SET @sNombreConsecutivot = 'DOC_VEN_' + LTRIM(@sCo_Tipo_DocOri)
	EXEC [dbo].[pEliminarConsecutivoTipo] @sNombreConsecutivot, NULL, @sMaquina, @sCo_Us_Mo, @sCo_Sucu_Mo, NULL	 
	
	SET @sNombreConsecutivot = 'DOC_COM_' + LTRIM(@sCo_Tipo_DocOri)
	EXEC [dbo].[pEliminarConsecutivoTipo] @sNombreConsecutivot, NULL, @sMaquina, @sCo_Us_Mo, @sCo_Sucu_Mo, NULL	

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
                    @sTablaOri = 'saTipoDocumento', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_Tipo_DocOri
            END
    END
```
