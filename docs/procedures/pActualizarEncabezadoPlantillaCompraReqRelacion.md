# SP: pActualizarEncabezadoPlantillaCompraReqRelacion
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saPlantillaCompraReqRelacion`](../tables/saPlantillaCompraReqRelacion.md)
- [`saPlantillaCompraReqRenglon`](../tables/saPlantillaCompraReqRenglon.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		<SOFTECH SISTEMAS>
-- Create date: <18/11/2009>
-- Description:	<Actualiza el Encabezado del Renglon para Indicar que cambio>
-- =============================================
CREATE PROCEDURE [dbo].[pActualizarEncabezadoPlantillaCompraReqRelacion]
    (
      @gRowguid_Reng_Req UNIQUEIDENTIFIER,
      @sMaquina VARCHAR(60),
      @sCo_Us_Mo CHAR(6),
      @sCo_Sucu_Mo CHAR(6),
      @tsValidador TIMESTAMP = null
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

        DECLARE @dtFe_In DATETIME

        DECLARE @rowGuidOri UNIQUEIDENTIFIER
			
        UPDATE
            saPlantillaCompraReqRenglon
        SET fe_us_mo = GETDATE(), co_us_mo = @sCo_Us_Mo
        OUTPUT
            inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            rowguid = @gRowguid_Reng_Req
            AND validador = @tsValidador



		--INSERT INTO @TableTimestamp (validador,fe_us_in,fe_us_mo,rowguid) 
		--		VALUES (@tsValidador,getdate(),getdate(),@rowGuidOri)

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

	-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
            @sTablaOri = 'saPlantillaCompraReqRelacion', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
			@sCampos = 'Actualización de renglón.'

        SELECT
            *
        FROM
            @TableTimestamp

    END
```
