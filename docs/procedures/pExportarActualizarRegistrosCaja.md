# SP: pExportarActualizarRegistrosCaja
**Tipo**: Procedimiento
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCaja`](../tables/saCaja.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarRegistrosCaja
*DESCRIPCIÓN	:	Inserta un Caja
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarActualizarRegistrosCaja]
    (
      @sCod_Caja			CHAR(6) ,
      @sCod_CajaOri			CHAR(6) ,
      @sDescrip				VARCHAR(60) ,
      @sdMes_Ini			SMALLDATETIME ,
      @sCo_Mone				CHAR(6) ,
      @sDis_Cen				VARCHAR(MAX) ,
      @bInactivo			BIT ,
      @sCampo1				VARCHAR(60)			= NULL ,
      @sCampo2				VARCHAR(60)			= NULL ,
      @sCampo3				VARCHAR(60)			= NULL ,
      @sCampo4				VARCHAR(60)			= NULL ,
      @sCampo5				VARCHAR(60)			= NULL ,
      @sCampo6				VARCHAR(60)			= NULL ,
      @sCampo7				VARCHAR(60)			= NULL ,
      @sCampo8				VARCHAR(60)			= NULL ,
      @sCampos				VARCHAR(MAX),		
      @sCo_us_in			CHAR(6) ,
      @sCo_sucu_in			CHAR(6)				= NULL ,
      @dFe_us_in			VARCHAR(60)			= NULL ,
      @sCo_us_mo			CHAR(6)				= NULL ,
      @sCo_sucu_mo			CHAR(6)				= NULL ,
      @sRevisado			CHAR(1) = '',
      @sTrasnfe				CHAR(1) = '',
      @sEmpresa				VARCHAR(60),
      @sMaquina				VARCHAR(60),
      @gRowguid				UNIQUEIDENTIFIER	= NULL
    )
AS 
    BEGIN
		
		DECLARE @sSql					NVARCHAR(4000) 
		DECLARE @tsValidador			TIMESTAMP
		DECLARE @sSqlValidador			NVARCHAR(200)
		
		SET @sSqlValidador = N'	SELECT @tsValidadorOUT = validador FROM  [' + @sempresa + '].[dbo].[saCaja] WHERE cod_caja = @scod_caja'  
		
		EXEC sp_executesql @query = @sSqlValidador, @params =	N'@tsValidadorOUT TIMESTAMP OUTPUT,		@scod_caja CHAR(6)',	
																@tsValidadorOUT = @tsValidador OUTPUT, @scod_caja = @scod_caja
																
		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pActualizarCaja]	@scod_Caja,
																		@scod_CajaOri,
																		@sDescrip,
																		@sdMes_Ini,
																		@sCo_Mone,
																		@sDis_Cen,
																		@bInactivo,
																		@sCampo1,
																		@sCampo2,
																		@sCampo3,
																		@sCampo4,
																		@sCampo5,
																		@sCampo6,
																		@sCampo7,
																		@sCampo8,
																		@sCampos,
																		@sCo_us_mo,
																		@sCo_sucu_mo,
																		@sTrasnfe,
																		@sMaquina,
																		@sRevisado,
																		@tsValidador
```
