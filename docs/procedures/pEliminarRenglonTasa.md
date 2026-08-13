# SP: pEliminarRenglonTasa
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saTasa`](../tables/saTasa.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pEliminarRenglonesTasa
*DESCRIPCIÓN	: Elimina un registro en la tabla saTasa
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [dbo].[pEliminarRenglonTasa]
    (
      @sCo_MoneOri CHAR(6) ,
      @sdFechaOri DATETIME ,
      @iRENG_NUMOri INT ,
      @sCo_Us_Mo CHAR(6) ,
      @sMaquina VARCHAR(60) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @gRowguid UNIQUEIDENTIFIER = NULL
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER,
			  tasa_c decimal(21,8),
			  tasa_v decimal(21,8),
			  fecha smalldatetime

            )

        DELETE FROM
            saTasa
        OUTPUT
            deleted.rowguid,
			deleted.tasa_c,
			deleted.tasa_v,
			deleted.fecha
            INTO @TableTimestamp
        WHERE
            co_mone = @sCo_MoneOri
            AND fecha = @sdFechaOri	

        DECLARE @dtFe_De DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER
		DECLARE @sCampos varchar(max)
		DECLARE @sfecha_regis varchar(30)

        SELECT
            @dtFe_De = GETDATE(), @rowGuidOri = rowguid, @sCampos = @sCo_MoneOri +' [tasa_c:]' + CONVERT(varchar(50),tasa_c) + ' [tasa_v:]' + CONVERT(varchar(50),tasa_v),
			@sfecha_regis =  CONVERT(varchar(20),fecha,120) 
        FROM
            @TableTimestamp

        IF @dtFe_De IS NOT NULL 
            BEGIN
				-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_De, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saTasa', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCampos , @sAUX02 =@sfecha_regis
            END


    END
```
