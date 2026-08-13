# SP: pActualizarRenglonesImpuestoSobreVenta
**Tipo**: Actualizar
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saImpuestoSobreVentaReng`](../tables/saImpuestoSobreVentaReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
CREADO			:	<2011-12-12>
MODIFICADO		:	<2020-07-27>
NOMBRE: pActualizarRenglonesImpuestoSobreVenta
DESCRIPCION: Actualiza un renglón de la tabla saImpuestoSobreVentaReng
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pActualizarRenglonesImpuestoSobreVenta]
    (
      @sdFecha SMALLDATETIME ,
      @sdFechaOri SMALLDATETIME ,
      @iReng_Num INT ,
      @iReng_NumOri INT ,
      @sTipo_Imp CHAR(1) ,
      @bVentas BIT ,
      @bCompras BIT ,
      @bConsumo_Suntuario BIT ,
      @dePorc_Tasa DECIMAL(18, 5) ,
      @dePorc_Suntuario DECIMAL(18, 5) ,
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
            saImpuestoSobreVentaReng
        SET fecha = @sdFecha, reng_num = @iReng_Num, tipo_imp = @sTipo_Imp, ventas = @bVentas, compras = @bCompras,
            consumo_suntuario = @bConsumo_Suntuario, porc_tasa = @dePorc_Tasa, porc_suntuario = @dePorc_Suntuario,
            co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE(), trasnfe = @sTrasnfe,
            revisado = @sRevisado
        OUTPUT
            inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            fecha = @sdFechaOri
            AND reng_num = @iReng_NumOri 
	
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

	-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
            @sTablaOri = 'saImpuestoSobreVentaReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
            @sCampos = @sCampos

        SELECT
            *
        FROM
            @TableTimestamp

    END
```
