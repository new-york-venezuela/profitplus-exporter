# SP: pExportarRegistrosCuentaIngEgr
**Tipo**: Procedimiento
**Módulo**: General

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarRegistrosCuentaIngEgr
*DESCRIPCIÓN	:	Inserta un CuentaIngEgr
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarRegistrosCuentaIngEgr]
    (
	  @sCo_Cta_Ingr_Egr		CHAR(20) ,
      @sDescrip				VARCHAR(60) ,
      @sCo_Islr				CHAR(6) ,
      @sDis_Cen				VARCHAR(MAX) = NULL ,
      
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
    if (@sCo_Islr = N'') 
    begin	
    set @sCo_Islr = null 
    end
		DECLARE @sSql		NVARCHAR(1500) 

		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pInsertarCuentaIngreso]	
																		@sCo_Cta_Ingr_Egr,
																		@sDescrip,
																		@sCo_Islr,
																		@sDis_Cen,
																	
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
	
		EXEC sp_executesql @sSql, N'@sCo_Cta_Ingr_Egr CHAR(20), @sDescrip VARCHAR(60) ,	@sCo_Islr CHAR(6) ,
									@sDis_Cen VARCHAR(MAX),			
		
									@sCampo1 VARCHAR(60), 		@sCampo2 VARCHAR(60), 		@sCampo3 VARCHAR(60), 
									@sCampo4 VARCHAR(60), 		@sCampo5 VARCHAR(60), 		@sCampo6 VARCHAR(60), 
									@sCampo7 VARCHAR(60), 		@sCampo8 VARCHAR(60), 		@sCo_us_in CHAR(6), 		
									@sCo_sucu_in CHAR(6), 		@sMaquina VARCHAR(60),		@sRevisado CHAR(1), 
									@sTrasnfe CHAR(1)',
									
									@sCo_Cta_Ingr_Egr,			@sDescrip,					@sCo_Islr, 
									@sDis_Cen,	
									
									@sCampo1,					@sCampo2,					@sCampo3,	
									@sCampo4,					@sCampo5,					@sCampo6,	
									@sCampo7,					@sCampo8,					@sCo_us_in,
```
