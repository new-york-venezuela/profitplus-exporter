# SP: pActualizarEncabezadoConsecutivoSucursal
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saSucursal`](../tables/saSucursal.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <17/08/2009>
-- Description:	<Actualiza el Encabezado del Renglon para Indicar que cambio>
-- =============================================
CREATE PROCEDURE [dbo].[pActualizarEncabezadoConsecutivoSucursal]
    (
      @sCodigo CHAR(20) ,
      @bEsParEmp BIT ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sMaquina VARCHAR(60) ,
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

        IF ( @bEsParEmp = 0 ) 
            BEGIN

                UPDATE
                    dbo.saSucursal
                SET fe_us_mo = GETDATE(), co_us_mo = @sCo_Us_Mo
                OUTPUT
                    inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                    INTO @TableTimestamp
                WHERE
                    co_sucur = @sCodigo
                    AND validador = @tsValidador

            END

        IF ( @bEsParEmp = 1 ) 
            BEGIN

                UPDATE
                    dbo.par_emp
                SET fe_us_mo = GETDATE(), co_us_mo = @sCo_Us_Mo
                OUTPUT
                    inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                    INTO @TableTimestamp
                WHERE
                    cod_emp = @sCodigo
                    AND validador = @tsValidador

            END
        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        IF @dtFe_In IS NOT NULL 
            BEGIN
			-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saSucursal', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
					@sCampos = 'Actualización de renglón.'
            END

        SELECT
            *
        FROM
            @TableTimestamp

    END
```
