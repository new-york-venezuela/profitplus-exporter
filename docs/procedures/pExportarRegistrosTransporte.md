# SP: pExportarRegistrosTransporte
**Tipo**: Procedimiento
**Módulo**: General

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarRegistrosTransporte
*DESCRIPCIÓN	:	Inserta un Transporte
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarRegistrosTransporte]
    (
      @sCo_Tran				CHAR(6) ,
      @sDes_Tran			VARCHAR(60) ,
      @sResp_Tra			VARCHAR(60) ,
      @sDis_Cen				VARCHAR(MAX)= NULL ,
      
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
	  @sidentificador_1     VARCHAR(100)= NULL ,
	  @sidentificador_2     VARCHAR(100)= NULL ,
	  @sidentificador_3     VARCHAR(100)= NULL ,
	  @sident_responsable   VARCHAR(100)= NULL ,
	  @sColorTransp         VARCHAR(100)= NULL ,
	  @sTelefono            VARCHAR(100)= NULL ,
	  @scontacto            VARCHAR(100)= NULL ,
	  @sNomApelCond         VARCHAR(200)= NULL ,
	  @sIdentificadorCond   VARCHAR(100)= NULL ,
	  @sContactoCond        VARCHAR(100)= NULL ,
	  @stipoLicCond         VARCHAR(30)= NULL ,
	  @sclasificacion       VARCHAR(1)= NULL ,
	  @itipoIdRespon        int= NULL ,
	  @itipoIdCond          int= NULL 
    )
AS 
    BEGIN
		DECLARE @sSql		NVARCHAR(1500) 

		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pInsertarTransporte]	
																		@sCo_Tran,
																		@sDes_Tran,
																		@sResp_Tra,
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
																		@sTrasnfe,
																		@sidentificador_1,
																		@sidentificador_2,  
																		@sidentificador_3, 
																		@sident_responsable,
																		@sColorTransp,
																		@sTe
```
