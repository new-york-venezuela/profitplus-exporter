# SP: pExportarRegistrosCuentaBancaria
**Tipo**: Procedimiento
**Módulo**: General

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarRegistrosCuentaBancaria
*DESCRIPCIÓN	:	Inserta un CuentaBancaria
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarRegistrosCuentaBancaria]
    (
--declare
      @sCod_Cta				CHAR(6) ,
      @sCo_Ban				CHAR(6) ,
      @sNum_Cta				VARCHAR(50) ,
      @sDis_Cen				VARCHAR(MAX)= NULL ,
      @sSucursal			VARCHAR(60) ,
      @sTelefono			VARCHAR(60) ,
      @sdMes_Ini			SMALLDATETIME ,
      @sCo_Mone				CHAR(6) ,
      @bInactivo			BIT ,
      @bUsa_Chra			BIT ,
      @sEjec_Cu				VARCHAR(30) ,
      @sDireccion			VARCHAR(MAX) ,
      @sEmail				VARCHAR(40) ,
      @sTipo_Cu				VARCHAR(30) ,
      @sdFecini				SMALLDATETIME ,
      @sdFec_Chra			SMALLDATETIME ,
	  @desaldo_ti           decimal(12,2)= null,-- sit 6017224 jortiz
	  @desaldo_ci           decimal(12,2)= null,-- sit 6017224 jortiz      
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

		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pInsertarCuentaBancaria]	
																		
																		@sCod_Cta,
																		@sCo_Ban,
																		@sNum_Cta,
																		@sDis_Cen,
																		@sSucursal,
																		@sTelefono,
																		@sdMes_Ini,
																		@sCo_Mone,
																		@bInactivo,
																		@bUsa_Chra,
																		@sEjec_Cu,
																		@sDireccion,
																		@sEmail,
																		@sTipo_Cu,
																		@sdFecini,
																		@sdFec_Chra,
																	    @desaldo_ti,
																		@desaldo_ci,
																		@sCampo1,
																		@sCampo2,
																		@sCampo3,
																		@sCampo4,
																		@sCampo5,
																		@sCampo6,
																		@sCampo7,
																		@sCampo8,
																		@sCo
```
