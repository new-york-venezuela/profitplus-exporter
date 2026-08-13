# SP: pInsertarValorImpuestoRenglon
**Tipo**: Insertar
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saImpuestoReng`](../tables/saImpuestoReng.md)

## Código (excerpt)
```sql
/******************************************************************
*NOMBRE			:	pInsertarValorImpuestoRenglon 
*DESCRIPCIÓN	:	Inserta un registro en la tabla  ImpuestoRenglon
*AUTOR			:	SOFTECH SISTEMAS
******************************************************************/

CREATE PROCEDURE [dbo].[pInsertarValorImpuestoRenglon]
    (
      @sCod_Impuesto CHAR(6) ,
      @deValor_Porcent DECIMAL(5,2) ,
      @sdFecha_Regis SMALLDATETIME ,
      @iReng_Num INT ,
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL ,
      @sTrasnfe CHAR(1) ,
      @sRevisado CHAR(1)
    )
AS 
    BEGIN

        DECLARE @TableTimestamp AS TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
		
        INSERT  INTO saImpuestoReng
                ( cod_impuesto, valor_porcent, fecha_regis, co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo,
                  fe_us_mo, revisado, trasnfe )
        OUTPUT  inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sCod_Impuesto, @deValor_Porcent, @sdFecha_Regis, @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sCo_Us_In,
                  @sCo_Sucu_In, GETDATE(), @sTrasnfe, @sRevisado )

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saImpuestoReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = @sCod_Impuesto, @deAUX01 =	@deValor_Porcent
	
        SELECT
            *
        FROM
            @TableTimestamp
	
    END
```
