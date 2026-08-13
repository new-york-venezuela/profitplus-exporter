# SP: pExportarRegistrosAlmacen
**Tipo**: Procedimiento
**Módulo**: Inventario

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarRegistrosAlmacen
*DESCRIPCIÓN	:	Inserta un Almacen
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarRegistrosAlmacen]
    (
      @sCo_Alma				CHAR(6) ,
      @sDes_Alma			VARCHAR(60) ,
      @sCo_Sucur			CHAR(6) ,
      @bNoventa				BIT ,
      @bNoCompra			BIT ,
      @bMateriales			BIT ,
      @bProduccion			BIT ,
      @bAlm_Temp			BIT ,  
      
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

		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pInsertarAlmacen]	@sCo_Alma,
																		@sDes_Alma,
																		@sCo_Sucur,
																		@bNoventa,
																		@bNoCompra,
																		@bMateriales,
																		@bProduccion,
																		@bAlm_Temp,
																	
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
	
		EXEC sp_executesql @sSql, N'@sCo_Alma CHAR(6),			@sDes_Alma VARCHAR(60),	@sCo_Sucur CHAR(6),
									@bNoventa BIT,				@bNoCompra BIT,			@bMateriales BIT,
									@bProduccion BIT,			@bAlm_Temp BIT,
		
									@sCampo1 VARCHAR(60), 		@sCampo2 VARCHAR(60), 		@sCampo3 VARCHAR(60), 
									@sCampo4 VARCHAR(60), 		@sCampo5 VARCHAR(60), 		@sCampo6 VARCHAR(60), 
									@sCampo7 VARCHAR(60), 		@sCampo8 VARCHAR(60), 		@sCo_us_in CHAR(6), 		
									@sCo_sucu_in CHAR(6), 		@sMaquina VARCHAR(60),		@sRevisado CHAR(1), 
									@sTrasnfe CHAR(1)',
									
									@sCo_Alma,					@sDes_Alma,					@sCo_Sucur, 
									@bNoventa,					@bNoCompr
```
