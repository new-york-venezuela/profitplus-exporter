# SP: pEliminarGeneracionComision
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saComisionGeneracion`](../tables/saComisionGeneracion.md)

## Código (excerpt)
```sql
/******************************************************************
*NOMBRE			:	pEliminarGeneracionComision 
*DESCRIPCIÓN	:	Elimina un registro en la tabla  GeneracionComision
*AUTOR			:	SOFTECH SISTEMAS
******************************************************************/
                       
CREATE PROCEDURE [pEliminarGeneracionComision]
    (
      @sCo_generacionOri CHAR(20) ,
      @tsvalidador TIMESTAMP ,
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
            saComisionGeneracion
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_generacion = @sCo_generacionOri
            AND validador = @tsvalidador

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
                    @sTablaOri = 'saComisionGeneracion', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_generacionOri
            END
    END
```
