# SP: pActualizarEncabezadoImpCtaBcaria
**Tipo**: Actualizar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saImpuestoCuentaBancaria`](../tables/saImpuestoCuentaBancaria.md)

## Código (excerpt)
```sql
-- ==============================================================================================
-- Author:		<SOFTECH SISTEMAS>
-- Create date: <10/03/2022>
-- Description:	<Actualiza el Encabezado del Renglon para Indicar que cambio>
-- ==============================================================================================

CREATE PROCEDURE [dbo].[pActualizarEncabezadoImpCtaBcaria]
    (
      @stipo_imp CHAR(3) ,
      @scod_cta CHAR(6) ,
	  @sMaquina VARCHAR(60) ,
	  @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @tsValidador TIMESTAMP = NULL                
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
            saCuentaBancaria
        SET fe_us_mo = GETDATE(), co_us_mo = @sCo_Us_Mo
        OUTPUT
            inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            cod_cta = @scod_cta
            AND validador = @tsValidador


        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

             IF @dtFe_In IS NOT NULL 
             BEGIN
                    EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
                           @sTablaOri = 'saImpuestoCuentaBancaria', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
                           @sCampos = 'Actualización de renglón.'
             END

        SELECT
            *
        FROM
            @TableTimestamp

    END
```
