# SP: pEliminarRenglonesPlantillaCompraReqRelacion
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saPlantillaCompraReqRelacion`](../tables/saPlantillaCompraReqRelacion.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			:	pEliminarRenglonesPlantillaCompraReqRelacion
*DESCRIPCIÓN	:	Elimina un renglon de requisicion
*AUTOR			:	SOFTECH SISTEMAS
*MODIFICADO POR	:	SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [dbo].[pEliminarRenglonesPlantillaCompraReqRelacion]
    (
        @gRowguid_Reng_Req UNIQUEIDENTIFIER,
		@gRowguid_Reng_Imp UNIQUEIDENTIFIER,
		@iRENG_NUMOri int, 
		@growguid UNIQUEIDENTIFIER,
		@sCo_Us_Mo char(6),
		@sMaquina VARCHAR(60) = NULL,
		@sCo_Sucu_Mo char(6)
    )
AS 
    BEGIN
        DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER
            )
		
        DELETE FROM
            saPlantillaCompraReqRelacion
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            rowguid_reng_req = @gRowguid_Reng_Req
            AND rowguid_reng_imp = @gRowguid_Reng_Imp

        DECLARE @dtFe_De DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_De = GETDATE(), @rowGuidOri = @gRowguid_Reng_Req
        FROM
            @TableTimestamp

        IF @dtFe_De IS NOT NULL 
            BEGIN
			-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_De, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saPlantillaCompraReqRelacion', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E',
                    @sMaquina = @sMaquina, @sCampos = @gRowguid_Reng_Req
            END
    END
```
