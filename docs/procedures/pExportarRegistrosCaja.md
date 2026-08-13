# SP: pExportarRegistrosCaja
**Tipo**: Procedimiento
**Módulo**: Tesorería

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarRegistrosCaja
*DESCRIPCIÓN	:	Inserta un Caja
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarRegistrosCaja]
    (
      @sCod_Caja			CHAR(6) ,
      @sDescrip				VARCHAR(60) ,
      @sdMes_Ini			SMALLDATETIME ,
      @sCo_Mone				CHAR(6) ,
      @sDis_Cen				VARCHAR(MAX) ,
      @bInactivo			BIT ,
      
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

		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pInsertarCaja]	@sCod_Caja,
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
																		@sCo_us_in,
																		@sCo_sucu_in,
																		@sMaquina,
																		@sRevisado,
																		@sTrasnfe'
	
		EXEC sp_executesql @sSql, N' @sCod_Caja	CHAR(6) ,		@sDescrip VARCHAR(60) ,		@sdMes_Ini	SMALLDATETIME ,
									 @sCo_Mone  CHAR(6) ,       @sDis_Cen VARCHAR(MAX) ,	@bInactivo	BIT ,
								
		
									@sCampo1 VARCHAR(60), 		@sCampo2 VARCHAR(60), 		@sCampo3 VARCHAR(60), 
									@sCampo4 VARCHAR(60), 		@sCampo5 VARCHAR(60), 		@sCampo6 VARCHAR(60), 
									@sCampo7 VARCHAR(60), 		@sCampo8 VARCHAR(60), 		@sCo_us_in CHAR(6), 		
									@sCo_sucu_in CHAR(6), 		@sMaquina VARCHAR(60),		@sRevisado CHAR(1), 
									@sTrasnfe CHAR(1)',
									
									@sCod_Caja,					@sDescrip,					@sdMes_Ini, 
									@sCo_Mone,					@sDis_Cen,					@bInactivo,				
									
									@sCampo1,					@sCampo2,					@sCampo3,	
									@sCampo4,					@sCampo5,					@sCampo
```
