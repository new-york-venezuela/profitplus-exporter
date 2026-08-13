# SP: pExportarRegistrosLinea
**Tipo**: Procedimiento
**Módulo**: General

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarRegistrosLinea
*DESCRIPCIÓN	:	Inserta una Linea
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarRegistrosLinea]
    (
      @sCo_Lin				CHAR(6) ,
      @sLin_Des				VARCHAR(60) ,
      @sDis_Cen				VARCHAR(MAX)= NULL ,
      @sCo_Imun				CHAR(15) ,
      @sCo_Reten			CHAR(6) ,
      @deComi_Lin			DECIMAL(18, 2) ,
      @deComi_Lin2			DECIMAL(18, 2) ,
      @bVa					BIT ,
      @sI_Lin_Des			VARCHAR(60) ,
      @bMovil				BIT ,
      
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
    if (@sCo_Imun = N'') 
    begin	
    set @sCo_Imun = null 
    end
    if (@sCo_Reten = N'') 
    begin	
    set @sCo_Reten = null 
    end
		DECLARE @sSql		NVARCHAR(1500) 

		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pInsertarLineaArticulo]	
																		
																		@sCo_Lin,
																		@sLin_Des,
																		@sDis_Cen,
																		@sCo_Imun,
																		@sCo_Reten,
																		@deComi_Lin,
																		@deComi_Lin2,
																		@bVa,
																		@sI_Lin_Des,
																		@bMovil,
																	
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
	
		EXEC sp_executesql @sSql, N'@sCo_Lin CHAR(6) ,			@sLin_Des VARCHAR(60),	@sDis_Cen VARCHAR(MAX),
									@sCo_Imun CHAR(15),			@sCo_Reten CHAR(6) ,    @deComi_Lin DECIMAL(18, 2) ,	
									@deComi_Lin2 DECIMAL(18,2), @bVa BIT ,				@sI_Lin_Des	VARCHAR(60) ,
									@bMovil	BIT ,
		
									@sCampo1 VARCHAR(60), 		@sC
```
