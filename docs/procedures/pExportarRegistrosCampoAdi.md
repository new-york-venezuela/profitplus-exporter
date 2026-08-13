# SP: pExportarRegistrosCampoAdi
**Tipo**: Procedimiento
**Módulo**: General

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarRegistrosCampoAdi
*DESCRIPCIÓN	:	Inserta un concepto de campo adicional
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarRegistrosCampoAdi]
    (
      @sCo_AdiCampo		CHAR(8) ,
      @sDes_AdiCampo	VARCHAR(60) ,
      @sCo_AdiGrupo		CHAR(8) ,
      @iTipo			INT ,
      @sVal_Str			VARCHAR(254) ,
      @deVal_Decimal	DECIMAL(18, 5) ,
      @iVal_Entero		INT ,
      @sdVal_Fecha		SMALLDATETIME ,
      @bFijo			BIT ,
      @sObservacion		VARCHAR(200) ,
      
      @sCampo1				VARCHAR(60) = NULL ,
      @sCampo2				VARCHAR(60) = NULL ,
      @sCampo3				VARCHAR(60) = NULL ,
      @sCampo4				VARCHAR(60) = NULL ,
      @sCampo5				VARCHAR(60) = NULL ,
      @sCampo6				VARCHAR(60) = NULL ,
      @sCampo7				VARCHAR(60) = NULL ,
      @sCampo8				VARCHAR(60) = NULL ,
      @sCo_us_in			CHAR(6) ,
      @sCo_sucu_in			CHAR(6)		= NULL ,
      @sRevisado			CHAR(1) ,
      @sTrasnfe				CHAR(1) ,
      @sEmpresa				VARCHAR(60),
      @sMaquina				VARCHAR(60)
    )
AS 
    BEGIN
		DECLARE @sSql		NVARCHAR(1500) 

		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pInsertarAdiCampo]@sCo_AdiCampo,
																		@sDes_AdiCampo,
																		@sCo_AdiGrupo,
																		@iTipo,
																		@sVal_Str,
																		@deVal_Decimal,
																		@iVal_Entero,
																		@sdVal_Fecha,
																		@bFijo,
																		@sObservacion,
																	
																		@sCampo1,
																		@sCampo2,
																		@sCampo3,
																		@sCampo4,
																		@sCampo5,
																		@sCampo6,
																		@sCampo7,
																		@sCampo8,
																		@sCo_us_in,
																		@sCo_sucu_in,
																		@sMaquina,
																		@sRevisado,
																		@sTrasnfe'
	
		EXEC sp_executesql @sSql, N'@sCo_AdiCampo CHAR(8) ,		@sDes_AdiCampo VARCHAR(60) ,	@sCo_AdiGrupo CHAR(8) ,
									@iTipo	INT ,				@sVal_Str VARCHAR(254),         @deVal_Decimal	DECIMAL(18, 5),
									@iVal_Entero		INT,    @sdVal_Fecha SMALLDATETIME ,    @bFijo			  BIT ,
									@sObservacion VARCHAR(200) ,	
		
									@sCampo1 VARCHAR(60), 		@sCampo2 VARCHAR(60), 		@sCampo3 VARCHAR(60), 
									@sCampo4 VARCHAR(60), 		@sCampo5 VARCHAR(60), 		@sCampo6 VARCHAR(
```
