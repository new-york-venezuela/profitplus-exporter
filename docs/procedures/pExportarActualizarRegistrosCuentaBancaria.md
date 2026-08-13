# SP: pExportarActualizarRegistrosCuentaBancaria
**Tipo**: Procedimiento
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarRegistrosCuentaBancaria
*DESCRIPCIÓN	:	Inserta un CuentaBancaria
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarActualizarRegistrosCuentaBancaria]
    (
      @sCod_Cta			CHAR(6) ,
      @sCod_CtaOri		CHAR(6) ,
      @sCo_Ban			CHAR(6) ,
      @sNum_Cta			VARCHAR(50) ,
      @sDis_Cen			VARCHAR(MAX)= NULL ,
      @sSucursal		VARCHAR(60) ,
      @sTelefono		VARCHAR(60) ,
      @sdMes_Ini		SMALLDATETIME ,
      @sCo_Mone			CHAR(6) ,
      @bInactivo		BIT ,
      @bUsa_Chra		BIT ,
      @sEjec_Cu			VARCHAR(30) ,
      @sDireccion		VARCHAR(MAX) ,
      @sEmail			VARCHAR(40) ,
      @sTipo_Cu			VARCHAR(30) ,
      @sdFecini			SMALLDATETIME ,
      @sdFec_Chra		SMALLDATETIME ,
      @sCampo1			VARCHAR(60)			= NULL ,
      @sCampo2			VARCHAR(60)			= NULL ,
      @sCampo3			VARCHAR(60)			= NULL ,
      @sCampo4			VARCHAR(60)			= NULL ,
      @sCampo5			VARCHAR(60)			= NULL ,
      @sCampo6			VARCHAR(60)			= NULL ,
      @sCampo7			VARCHAR(60)			= NULL ,
      @sCampo8			VARCHAR(60)			= NULL ,
      @sCampos			VARCHAR(MAX),		
      @sCo_us_in		CHAR(6) ,
      @sCo_sucu_in		CHAR(6)				= NULL ,
      @dFe_us_in		VARCHAR(60)			= NULL ,
      @sCo_us_mo		CHAR(6)				= NULL ,
      @sCo_sucu_mo		CHAR(6)				= NULL ,
      @sRevisado		CHAR(1) = '',
      @sTrasnfe			CHAR(1) = '',
      @sEmpresa			VARCHAR(60),
      @sMaquina			VARCHAR(60),
      @gRowguid			UNIQUEIDENTIFIER	= NULL,
	  @desaldo_ti       decimal (12,2) = null,--sit 6017224
	  @desaldo_ci       decimal (12,2) = null--sit 6017224
    )
AS 
    BEGIN
		
		DECLARE @sSql					NVARCHAR(4000) 
		DECLARE @tsValidador			TIMESTAMP
		DECLARE @sSqlValidador			NVARCHAR(200)
		
		SET @sSqlValidador = N'	SELECT @tsValidadorOUT = validador FROM  [' + @sempresa + '].[dbo].[saCuentaBancaria] WHERE Cod_Cta = @sCod_Cta'  
		
		EXEC sp_executesql @query = @sSqlValidador, @params =	N'@tsValidadorOUT TIMESTAMP OUTPUT,		@sCod_Cta CHAR(6)',	
																@tsValidadorOUT = @tsValidador OUTPUT, @sCod_Cta = @sCod_Cta
																
		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pActualizarCuentaBancaria] 
																		@sCod_Cta,
																		@sCod_CtaOri,
																		@sCo_Ban,
																		@sNum_Cta,
																		@sDis_Cen,
																		@sSucursal,
```
