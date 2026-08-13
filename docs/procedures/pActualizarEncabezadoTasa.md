# SP: pActualizarEncabezadoTasa
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saMoneda`](../tables/saMoneda.md)

## Código (excerpt)
```sql
-- ==============================================================================================
-- Author:		<SOFTECH SISTEMAS>
-- Create date: <17/08/2009>
-- Description:	<Actualiza el Encabezado del Renglon para Indicar que cambio>
-- ==============================================================================================

CREATE PROCEDURE [dbo].[pActualizarEncabezadoTasa]
    (
      @sCo_Mone CHAR(6) ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sMaquina VARCHAR(60) ,
      @tsValidador TIMESTAMP = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL               
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
            saMoneda
        SET fe_us_mo = GETDATE(), co_us_mo = @sCo_Us_Mo
        OUTPUT
            inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            Co_Mone = @sCo_Mone
            AND validador = @tsValidador

        DECLARE @sCampos varchar(max)
		set @sCampos = 'Actualización de renglón.' + @sCo_Mone

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

             IF @dtFe_In IS NOT NULL 
             BEGIN
                    EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
                           @sTablaOri = 'saMoneda', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
                           @sCampos = @sCampos
             END

        SELECT
            *
        FROM
            @TableTimestamp

    END
```
