# SP: pExportarActualizarRegistrosTransporte
**Tipo**: Procedimiento
**Módulo**: General

## Tablas Referenciadas
- [`saTransporte`](../tables/saTransporte.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarRegistrosTransporte
*DESCRIPCIÓN	:	Inserta un Transporte
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarActualizarRegistrosTransporte]
    (
      @sCo_Tran			CHAR(6) ,
      @sCo_TranOri		CHAR(6) ,
      @sDes_Tran		VARCHAR(60) ,
      @sResp_Tra		VARCHAR(60) ,
      @sDis_Cen			VARCHAR(MAX)= NULL ,
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
	  @sidentificador_1     VARCHAR(100)= NULL ,
	  @sidentificador_2     VARCHAR(100)= NULL ,
	  @sidentificador_3     VARCHAR(100)= NULL ,
	  @sident_responsable   VARCHAR(100)= NULL ,
	  @sColorTransp         VARCHAR(100)= NULL ,
	  @sTelefono            VARCHAR(100)= NULL ,
	  @scontacto            VARCHAR(100)= NULL ,
	  @sNomApelCond         VARCHAR(200)= NULL ,
	  @sIdentificadorCond   VARCHAR(100)= NULL ,
	  @sContactoCond        VARCHAR(100)= NULL ,
	  @stipoLicCond         VARCHAR(30)= NULL ,
	  @sclasificacion       VARCHAR(1)= NULL ,
	  @itipoIdRespon        int= NULL ,
	  @itipoIdCond          int= NULL 
    )
AS 
    BEGIN
		
		DECLARE @sSql					NVARCHAR(4000) 
		DECLARE @tsValidador			TIMESTAMP
		DECLARE @sSqlValidador			NVARCHAR(200)
		
		SET @sSqlValidador = N'	SELECT @tsValidadorOUT = validador FROM  [' + @sempresa + '].[dbo].[saTransporte] WHERE Co_Tran = @sCo_Tran'  
		
		EXEC sp_executesql @query = @sSqlValidador, @params =	N'@tsValidadorOUT TIMESTAMP OUTPUT,		@sCo_Tran CHAR(6)',	
																@tsValidadorOUT = @tsValidador OUTPUT, @sCo_Tran = @sCo_Tran
																
		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pActualizarTransporte] 
																		@sCo_Tran,
																		@sCo_TranO
```
