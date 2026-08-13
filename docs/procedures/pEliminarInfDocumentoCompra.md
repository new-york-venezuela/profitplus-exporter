# SP: pEliminarInfDocumentoCompra
**Tipo**: Eliminar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saNCFInfoDocCompra`](../tables/saNCFInfoDocCompra.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pEliminarInfDocumentoCompra
DESCRIPCION	: Elimina un registro de la tabla saDocumentoCompra
CREADO POR	: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pEliminarInfDocumentoCompra]
    (
      @sTipo_DocOri CHAR(6) ,
      @sNro_DocOri CHAR(20) ,
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
            saNCFInfoDocCompra
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            tipo_doc = @sTipo_DocOri
            AND nro_doc = @sNro_DocOri
            AND validador = @tsValidador

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
                    @sTablaOri = 'saNCFInfoDocCompra', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sNro_DocOri
            END

    END
```
