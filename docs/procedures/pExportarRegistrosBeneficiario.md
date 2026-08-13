# SP: pExportarRegistrosBeneficiario
**Tipo**: Procedimiento
**Módulo**: General

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarRegistrosBeneficiario
*DESCRIPCIÓN	:	Inserta un Beneficiario
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarRegistrosBeneficiario]
    (
      @sCod_Ben			CHAR(10) ,
      @sBen_Des			VARCHAR(60) ,
      @sRif				VARCHAR(18) ,
      @sNit				VARCHAR(18) ,
      @sTelefonos		VARCHAR(60) ,
      @sDirec1			VARCHAR(MAX) ,
      @sDis_Cen			VARCHAR(MAX) ,
      @bInactivo		BIT ,
      @sCampo1			VARCHAR(60) = NULL ,
      @sCampo2			VARCHAR(60) = NULL ,
      @sCampo3			VARCHAR(60) = NULL ,
      @sCampo4			VARCHAR(60) = NULL ,
      @sCampo5			VARCHAR(60) = NULL ,
      @sCampo6			VARCHAR(60) = NULL ,
      @sCampo7			VARCHAR(60) = NULL ,
      @sCampo8			VARCHAR(60) = NULL ,
      @sCo_us_in		CHAR(6) ,
      @sCo_sucu_in		CHAR(6)		= NULL ,
      @sMaquina			VARCHAR(60),
      @sRevisado		CHAR(1) ,
      @sTrasnfe			CHAR(1) ,
      @sTipo_Per		CHAR(1) ,
      @sCo_Tab			CHAR(20),
      @sEmpresa			VARCHAR(60)
    )
AS 
    BEGIN
    if (@sCo_Tab = N'') 
    begin	
    set @sCo_Tab = null 
    end
		DECLARE @sSql		NVARCHAR(4000) 

		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pInsertarBeneficiario]
																		@sCod_Ben,
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
																		@sCampo7,
																		@sCampo8,
																		@sCo_us_in,
																		@sCo_sucu_in,
																		@sMaquina,
																		@sRevisado,
																		@sTrasnfe,
																		@sTipo_Per,
																		@sCo_Tab'
										

		EXEC sp_executesql @sSql, N'		@sCod_Ben					CHAR(10) ,
											@sBen_Des					VARCHAR(60) ,
											@sRif						VARCHAR(18) ,
											@sNit						VARCHAR(18) ,
											@sTelefonos					VARCHAR(60) ,
											@sDirec1					VARCHAR(MAX) ,
											@sDis_Cen					VARCHAR(MAX) ,
											@bInactivo					BIT ,
											@sTipo_Per					CHAR(1),
											@sCo_Tab					CHAR(20),
		
									@sCampo1 VARCHAR(60), 		@sCampo2 VARCHAR(60),
```
