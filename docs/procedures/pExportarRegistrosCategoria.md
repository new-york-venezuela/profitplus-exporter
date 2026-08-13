# SP: pExportarRegistrosCategoria
**Tipo**: Procedimiento
**Módulo**: General

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarRegistrosCategoria
*DESCRIPCIÓN	:	Inserta una Categoria
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarRegistrosCategoria]
    (
      @sCo_Cat				CHAR(6) ,
      @sCat_Des				VARCHAR(60) ,
      @sCo_Imun				CHAR(15) ,
      @sCo_Reten			CHAR(6) ,
      @sDis_Cen				VARCHAR(MAX) = NULL ,
      @sCo_Sucu				CHAR(6) = NULL ,
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
      @sCo_sucu_in			CHAR(6)	= NULL ,
      @sRevisado			CHAR(1) ,
      @sEmpresa				VARCHAR(60),
      @sMaquina				VARCHAR(60),
      @sTrasnfe				CHAR(1) 
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
		DECLARE @sSql		NVARCHAR(4000) 

		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pInsertarCategoriaArticulo]	@sCo_Cat, @sCat_Des,@sCo_Imun,@sCo_Reten,@sDis_Cen,@sCo_Sucu,@bMovil,
																					@sCampo1, @sCampo2, @sCampo3, @sCampo4, @sCampo5, @sCampo6, 
																					@sCampo7, @sCampo8, @sCo_us_in, @sCo_sucu_in, @sMaquina, @sRevisado, @sTrasnfe'
	
		EXEC sp_executesql @sSql, N'@sCo_Cat CHAR(10),	@sCat_Des VARCHAR(60), @sCo_Imun CHAR(15), @sCo_Reten CHAR(6), @sDis_Cen VARCHAR(MAX),	@sCo_Sucu char(6), @bMovil BIT,	
									@sCampo1 VARCHAR(60), 		@sCampo2 VARCHAR(60), 		@sCampo3 VARCHAR(60), 
									@sCampo4 VARCHAR(60), 		@sCampo5 VARCHAR(60), 		@sCampo6 VARCHAR(60), 
									@sCampo7 VARCHAR(60), 		@sCampo8 VARCHAR(60), 		@sCo_us_in CHAR(6), 		
									@sCo_sucu_in CHAR(6), 		@sMaquina VARCHAR(60),		@sRevisado CHAR(1), 
									@sTrasnfe CHAR(1)',
									
									@sCo_Cat,					@sCat_Des,					@sCo_Imun,
									@sCo_Reten,					@sDis_Cen, 					@sCo_Sucu, @bMovil,							
									
									@sCampo1,					@sCampo2,					@sCampo3,	
									@sCampo4,					@sCampo5,					@sCampo6,	
									@sCampo7,					@sCampo8,					@sCo_us_in,	
									@sCo_sucu_in,				@sMaquina,					@sRevisado,		
									@sTrasnf
```
