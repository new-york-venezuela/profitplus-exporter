# SP: pEliminarRenglonesDistribCostoOrigen
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saDistribCostoOrigenReng`](../tables/saDistribCostoOrigenReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pEliminarRenglonesDistribCostoOrigen
DESCRIPCION	: Elimina un registro de la tabla saDistribCostoOrigenReng
CREADO POR	: SOFTECH SISTEMAS
MODIFICADO	: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pEliminarRenglonesDistribCostoOrigen]
    (
      @sDistrib_NumOri CHAR(20) ,
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

        DELETE FROM
            saDistribCostoOrigenReng
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            Distrib_num = @sDistrib_NumOri
            AND reng_num = @iReng_NumOri	
		
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
                    @sTablaOri = 'saDistribCostoOrigenReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sDistrib_NumOri
            END

    END
```
