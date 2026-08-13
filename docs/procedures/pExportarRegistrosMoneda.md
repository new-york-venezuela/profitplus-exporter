# SP: pExportarRegistrosMoneda
**Tipo**: Procedimiento
**Módulo**: General

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarRegistrosMoneda
*DESCRIPCIÓN	:	Inserta un concepto de moneda
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarRegistrosMoneda]
    (
      @sCo_Mone				CHAR(6) ,
      @sMone_Des			VARCHAR(60) ,
      @deCambio				DECIMAL(18, 5) ,
      @bRelacion			BIT,
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
		DECLARE @sSql		NVARCHAR(4000) 

		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pInsertarMoneda]	@sCo_Mone,
																		@sMone_Des,
																		@deCambio,
																		@bRelacion,
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
	
		EXEC sp_executesql @sSql, N'@sCo_Mone CHAR(6) ,			@sMone_Des VARCHAR(60) ,    @deCambio DECIMAL(18, 5) ,
									@bRelacion BIT ,
		
									@sCampo1 VARCHAR(60), 		@sCampo2 VARCHAR(60), 		@sCampo3 VARCHAR(60), 
									@sCampo4 VARCHAR(60), 		@sCampo5 VARCHAR(60), 		@sCampo6 VARCHAR(60), 
									@sCampo7 VARCHAR(60), 		@sCampo8 VARCHAR(60), 		@sCo_us_in CHAR(6), 		
									@sCo_sucu_in CHAR(6), 		@sMaquina VARCHAR(60),		@sTrasnfe CHAR(1),	
									@sRevisado CHAR(1)',
									
									@sCo_Mone,					@sMone_Des,					@deCambio, 
									@bRelacion,						
									
									@sCampo1,					@sCampo2,					@sCampo3,	
									@sCampo4,					@sCampo5,					@sCampo6,	
									@sCampo7,					@sCampo8,					@sCo_us_in,	
									@sCo_sucu_in,				@sTrasnfe ,					@sRevisado,		
									@sMaquina
	END
```
