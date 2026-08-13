# SP: pExportarRegistrosImpMun
**Tipo**: Procedimiento
**Módulo**: General

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarRegistrosImpMun
*DESCRIPCIÓN	:	Inserta un concepto de impuesto municipal
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarRegistrosImpMun]
    (
      @sCo_Imun				CHAR(15) ,
      @sCo_Sucur			CHAR(6) ,
      @sImp_Des				VARCHAR(60) ,
      @sN_Act				CHAR(20) ,
      @deAlicuota			DECIMAL(6, 2) ,
      @deM_Trib				DECIMAL(18, 2) ,
      
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

		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pInsertarImpuestoMunicipal]	
																		
																		@sCo_Imun,
																		@sCo_Sucur,
																		@sImp_Des,
																		@sN_Act,
																		@deAlicuota,
																		@deM_Trib,
																		
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
	
		EXEC sp_executesql @sSql, N'@sCo_Imun CHAR(15) ,		@sCo_Sucur CHAR(6) ,		@sImp_Des VARCHAR(60) ,
									@sN_Act	CHAR(20) ,			@deAlicuota	DECIMAL(6,2),	@deM_Trib DECIMAL(18, 2) ,
		
									@sCampo1 VARCHAR(60), 		@sCampo2 VARCHAR(60), 		@sCampo3 VARCHAR(60), 
									@sCampo4 VARCHAR(60), 		@sCampo5 VARCHAR(60), 		@sCampo6 VARCHAR(60), 
									@sCampo7 VARCHAR(60), 		@sCampo8 VARCHAR(60), 		@sCo_us_in CHAR(6), 		
									@sCo_sucu_in CHAR(6), 		@sMaquina VARCHAR(60),		@sRevisado CHAR(1), 
									@sTrasnfe CHAR(1)',
									
									@sCo_Imun,					@sCo_Sucur,					@sImp_Des, 
									@sN_Act,					@deAlicuota,				@deM_Trib,				
									
									@sCa
```
