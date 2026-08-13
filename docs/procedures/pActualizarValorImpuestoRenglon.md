# SP: pActualizarValorImpuestoRenglon
**Tipo**: Actualizar
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saImpuestoReng`](../tables/saImpuestoReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pActualizarValorImpuestoRenglon]
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pActualizarValorImpuestoRenglon]
    (
      @sCod_Impuesto CHAR(6) ,
      @sCod_ImpuestoOri CHAR(6) ,
      @sdFecha_Regis SMALLDATETIME ,
      @sdFecha_RegisOri SMALLDATETIME ,
      @deValor_Porcent DECIMAL ,
      @iReng_Num INT ,
      @iReng_NumOri INT ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL 
    )
AS 
    BEGIN  
        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
    
        UPDATE
            saImpuestoReng
        SET cod_impuesto = @sCod_Impuesto, fecha_regis = @sdFecha_Regis, valor_porcent = @deValor_Porcent,
            co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE(), trasnfe = @sTrasnfe,
            revisado = @sRevisado
        OUTPUT
            inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            cod_impuesto = @sCod_ImpuestoOri
            AND fecha_regis = @sdFecha_RegisOri 
	
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

	-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
            @sTablaOri = 'saImpuestoReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
            @sCampos = @sCampos

        SELECT
            *
        FROM
            @TableTimestamp

    END
```
