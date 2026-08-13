# SP: pInsertarRenglonesImpuestoSobreVenta
**Tipo**: Insertar
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saImpuestoSobreVentaReng`](../tables/saImpuestoSobreVentaReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
*CREADO			:	<2011-12-12>
*MODIFICADO		:	<2020-07-27>
NOMBRE: pInsertarRenglonesImpuestoSobreVenta
DESCRIPCION: Inserta un renglón dentro de la tabla  saImpuestoSobreVentaReng
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pInsertarRenglonesImpuestoSobreVenta]
    (
      @sdFecha SMALLDATETIME ,
      @iReng_Num INT ,
      @sTipo_Imp CHAR(1) ,
      @bVentas BIT ,
      @bCompras BIT ,
      @bConsumo_Suntuario BIT ,
      @dePorc_Tasa DECIMAL(18, 5) ,
      @dePorc_Suntuario DECIMAL(18, 5) ,
      @sCo_Us_In CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCo_Sucu_In CHAR(6) ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL
    )
AS 
    BEGIN
        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

        INSERT  INTO saImpuestoSobreVentaReng
                ( fecha, reng_num, tipo_imp, ventas, compras, consumo_suntuario, porc_tasa, porc_suntuario, co_us_in,
                  co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo, trasnfe, revisado )
        OUTPUT  inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sdFecha, @iReng_Num, @sTipo_Imp, @bVentas, @bCompras, @bConsumo_Suntuario, @dePorc_Tasa,
                  @dePorc_Suntuario, @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sTrasnfe,
                  @sRevisado )	

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER
		DECLARE @sFecCrea varchar(20)
		DECLARE @sTipoImp varchar(20)
		set @sTipoImp = 'Tipo Imp:' + @sTipo_Imp
		set @sFecCrea =CONVERT(varchar(20),@sdFecha,120)
        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

	-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saImpuestoSobreVentaReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = @sFecCrea, @deAUX01 =@dePorc_Tasa, @sAUX02 =  @sTipoImp
	
        SELECT
            *
        FROM
```
