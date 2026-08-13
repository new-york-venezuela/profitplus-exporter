# SP: pActualizarEncabezadoImpuesto
**Tipo**: Actualizar
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saImpuesto`](../tables/saImpuesto.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		<SOFTECH SISTEMAS>
-- Create date: <14/09/2009>
-- Description:	<Actualiza el validador de la tabla  saImpuesto para Indicar si cambio>
-- =============================================
CREATE PROCEDURE [dbo].[pActualizarEncabezadoImpuesto]
    (
      @sCod_Impuesto CHAR(6) ,
      @sCo_Us_Mo CHAR(6) = NULL ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @tsValidador TIMESTAMP ,
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
            saImpuesto
        SET fe_us_mo = GETDATE(), co_us_mo = @sCo_Us_Mo
        OUTPUT
            inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            cod_impuesto = @sCod_Impuesto
            AND validador = @tsValidador

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        IF @dtFe_In IS NOT NULL 
            BEGIN
			-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saImpuesto', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
					@sCampos = 'Actualización de renglón.'
            END

        SELECT
            *
        FROM
            @TableTimestamp

    END
```
