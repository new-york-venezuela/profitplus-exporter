# SP: pExportarRegistrosBanco
**Tipo**: Procedimiento
**Módulo**: Tesorería

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarRegistrosBanco
*DESCRIPCIÓN	:	Inserta un banco
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarRegistrosBanco]
    (
      @sCo_Ban				CHAR(6) ,
      @sDes_Ban				VARCHAR(60) ,
      @sTelefonos			VARCHAR(60) = NULL ,
      @iPlazo1				INT ,
      @iPlazo2				INT ,
      @iPlazo3				INT ,
      @iPlazo4				INT ,

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

		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pInsertarBanco]	@sCo_Ban,
																		@sDes_Ban,
																		@sTelefonos,
																		@iPlazo1,
																		@iPlazo2,
																		@iPlazo3,
																		@iPlazo4,

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
										
		EXEC sp_executesql @sSql, N'		@sCo_Ban				CHAR(6),
											@sDes_Ban				VARCHAR(60),
											@sTelefonos				VARCHAR(60),
											@iPlazo1				INT ,
											@iPlazo2				INT ,
											@iPlazo3				INT ,
											@iPlazo4				INT ,
		
									@sCampo1 VARCHAR(60), 		@sCampo2 VARCHAR(60), 		@sCampo3 VARCHAR(60), 
									@sCampo4 VARCHAR(60), 		@sCampo5 VARCHAR(60), 		@sCampo6 VARCHAR(60), 
									@sCampo7 VARCHAR(60), 		@sCampo8 VARCHAR(60), 		@sCo_us_in CHAR(6), 		
									@sCo_sucu_in CHAR(6), 		@sMaquina VARCHAR(60),		@sRevisado CHAR(1), 
									@sTrasnfe CHAR(1)',
									
									@sCo_Ban,					 
									@sDes_Ban,						
									@sTelefonos,					
									@iPlazo1,					
									@iPlazo2,
```
