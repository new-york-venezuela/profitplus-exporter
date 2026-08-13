# SP: pInsertarComisionResultado
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saComisionResultado`](../tables/saComisionResultado.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pInsertarComisionResultado]
DESCRIPCION: Insertar los resultados del calculo de comisiones
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pInsertarComisionResultado]
    (
		@gCo_ComiResult Uniqueidentifier = null,
		@sCo_Generacion CHAR(20) ,
		@sTablaOri VARCHAR(32) ,
		@gIdOri Uniqueidentifier ,
		@deMonto_01 Decimal(18,2) ,
		@deMonto_02 Decimal(18,2) ,
		@deMonto_03 Decimal(18,2) ,
		@deMonto_04 Decimal(18,2) ,
		@deMonto_05 Decimal(18,2) ,
		@deMonto_06 Decimal(18,5) ,
		@deMonto_07 Decimal(18,5) ,
		@deMonto_08 Decimal(18,5) ,
		@deMonto_09 Decimal(18,5) ,
		@deMonto_10 Decimal(18,5) ,
		@sAux_01 VARCHAR(128),
		@sAux_02 VARCHAR(128),
		@sAux_03 VARCHAR(128),
		@sAux_04 VARCHAR(128),
		@sAux_05 VARCHAR(128),
		@dtFecha_01 datetime,
		@dtFecha_02 datetime,
		@dtFecha_03 datetime,
		@dtFecha_04 datetime,
		@dtFecha_05 datetime
    )
AS 
    BEGIN  
        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              rowguid UNIQUEIDENTIFIER
            ) ;

		If  @gCo_ComiResult is null
			   Set @gCo_ComiResult = newid()

        INSERT  INTO saComisionResultado
                (co_comiresult, co_generacion, TablaOri, IdOri, 
				Monto_01, Monto_02, Monto_03, Monto_04, Monto_05,
				Monto_06, Monto_07, Monto_08, Monto_09, Monto_10,
				Aux_01, Aux_02, Aux_03, Aux_04, Aux_05, 
				Fecha_01, Fecha_02, Fecha_03, Fecha_04, Fecha_05, fe_us_in)
        OUTPUT  Inserted.fe_us_in, Inserted.co_comiresult
                INTO @TableTimestamp
        VALUES
                ( @gCo_ComiResult, @sco_generacion, @sTablaOri, @gIdOri, 
				@deMonto_01, @deMonto_02, @deMonto_03, @deMonto_04, @deMonto_05,
				@deMonto_06, @deMonto_07, @deMonto_08, @deMonto_09, @deMonto_10,
				@sAux_01, @sAux_02, @sAux_03, @sAux_04, @sAux_05, 
				@dtFecha_01, @dtFecha_02, @dtFecha_03, @dtFecha_04, @dtFecha_05, getdate() )

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = 'GENCOMI', @dtFecha = @dtFe_In, @sCo_Sucu = 'N/A',
            @sTablaOri = 'saComis
```
