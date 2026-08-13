# SP: pExportarActualizarRegistrosBeneficiario
**Tipo**: Procedimiento
**Módulo**: General

## Tablas Referenciadas
- [`saBeneficiario`](../tables/saBeneficiario.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarRegistrosBeneficiario
*DESCRIPCIÓN	:	Inserta un Beneficiario
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarActualizarRegistrosBeneficiario]
    (
	  @sCod_Ben			CHAR(10) ,
      @sCod_BenOri		CHAR(10) ,
      @sBen_Des			VARCHAR(60) ,
      @sRif				VARCHAR(18) ,
      @sNit				VARCHAR(18) ,
      @sTelefonos		VARCHAR(60) ,
      @sDirec1			VARCHAR(MAX) ,
      @sDis_Cen			VARCHAR(MAX)= NULL ,
      @bInactivo		BIT ,
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
      @sTipo_Per		CHAR(1) ,
      @sCo_Tab			CHAR(20) ,
      @sEmpresa			VARCHAR(60),
      @sMaquina			VARCHAR(60),
      @gRowguid			UNIQUEIDENTIFIER	= NULL
    )
AS 
    BEGIN
    if (@sCo_Tab = N'') 
    begin	
    set @sCo_Tab = null 
    end
		
		DECLARE @sSql					NVARCHAR(4000) 
		DECLARE @tsValidador			TIMESTAMP
		DECLARE @sSqlValidador			NVARCHAR(200)
		
		SET @sSqlValidador = N'	SELECT @tsValidadorOUT = validador FROM  [' + @sempresa + '].[dbo].[saBeneficiario] WHERE Cod_Ben = @sCod_Ben'  
		
		EXEC sp_executesql @query = @sSqlValidador, @params =	N'@tsValidadorOUT TIMESTAMP OUTPUT,		@sCod_Ben CHAR(10)',	
																@tsValidadorOUT = @tsValidador OUTPUT, @sCod_Ben = @sCod_Ben								
		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pActualizarBeneficiario] 
																		@sCod_Ben,
																		@sCod_BenOri,
																		@sBen_Des,
																		@sRif,
																		@sNit,
																		@sTelefonos,
																		@sDirec1,
																		@sDis_Cen,
																		@bInactivo,
																		@sCampo1,
																		@sCampo2,
																		@sCampo3,
																		@sCampo4,
																		@sCampo5,
																		@sCampo6,
```
