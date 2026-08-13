# SP: pExportarRegistrosSubLinea
**Tipo**: Procedimiento
**Módulo**: General

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarRegistrosSubLinea
*DESCRIPCIÓN	:	Inserta una SubLinea
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarRegistrosSubLinea]
    (
      @sCo_Subl				CHAR(6) ,
      @sSubl_Des			VARCHAR(60) ,
      @sCo_Lin				CHAR(6) ,
      
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
      @sMaquina				VARCHAR(60),
      @sCo_Imun				CHAR(15) ,
      @sCo_Reten			CHAR(6) ,
      @sI_Subl_Des			VARCHAR(60) ,
      @bMovil				BIT	
    )
AS 

    BEGIN
    if (@sCo_Imun = N'') 
    begin	
    set @sCo_Imun = null 
    end
    if (@sCo_Reten = N'') 
    begin	
    set @sCo_Reten = null 
    end
    
		DECLARE @sSql		NVARCHAR(1500) 

		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pInsertarSubLinea]	
																		@sCo_Subl,
																		@sSubl_Des,
																		@sCo_Lin,
																	
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
																		@sTrasnfe,
																		@sCo_Imun,
																		@sCo_Reten,
																		@sI_Subl_Des,
																		@bMovil'
	
		EXEC sp_executesql @sSql, N'@sCo_Subl CHAR(6) ,			@sSubl_Des VARCHAR(60),		@sCo_Lin CHAR(6) ,
						
		
									@sCampo1 VARCHAR(60), 		@sCampo2 VARCHAR(60), 		@sCampo3 VARCHAR(60), 
									@sCampo4 VARCHAR(60), 		@sCampo5 VARCHAR(60), 		@sCampo6 VARCHAR(60), 
									@sCampo7 VARCHAR(60), 		@sCampo8 VARCHAR(60), 		@sCo_us_in CHAR(6), 		
									@sCo_sucu_in CHAR(6), 		@sMaquina VARCHAR(60),		@sRevisado CHAR(1), 
									@sTrasnfe CHAR(1),			@sCo_Imun	CHAR(15) ,		@sCo_Reten CHAR(6) ,
									@sI_Subl_Des VA
```
