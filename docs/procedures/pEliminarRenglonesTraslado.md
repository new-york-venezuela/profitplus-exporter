# SP: pEliminarRenglonesTraslado
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pEliminarRenglonesTraslado 
DESCRIPCION: Elimina los renglones de la tabla TrasladoReng
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pEliminarRenglonesTraslado]
    (
      @sTras_NumOri CHAR(20) ,
      @iReng_NumOri INT ,
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
            saTrasladoReng
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            tras_num = @sTras_NumOri
            AND reng_num = @iReng_NumOri

        DECLARE @dtFe_De DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_De = GETDATE(), @rowGuidOri = rowguid
        FROM
            @TableTimestamp
		
	--Eliminar Historico de Costos
        EXEC [dbo].[pCostoEliminarSalida] @RowGuid_Doc_Orig = @rowGuidOri, @strTipo_doc = 'TRAS'
        EXEC [dbo].[pCostoEliminarEntrada] @RowGuid_Doc_Orig = @rowGuidOri, @strTipo_doc = 'TRAS'

	--Elimnar Seriales de Entrada del renglon
        EXEC [dbo].[pEliminarSerialesSalidaRenglon] @sTipo_Doc = N'TRAS', @gRowguid = @rowGuidOri
    --DN 11125 ini
		EXEC [dbo].[pEliminarRenglonLoteSalida] @gRowguid_Reng = @rowGuidOri,
            @sTipo_doc = N'TRAS', @sTablaOri = N'saTrasladoReng', @sCo_Us_Mo = @sCo_Us_Mo,
            @sMaquina =@sMaquina, @sCo_Sucu_Mo = @sCo_Sucu_Mo
     --DN 11125 fin
        IF @dtFe_De IS NOT NULL 
            BEGIN
		-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_De, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saTrasladoReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sTras_NumOri
            END
    END
```
