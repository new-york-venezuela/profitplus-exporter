# SP: pExportarActualizarRegistrosTarjeta
**Tipo**: Procedimiento
**Módulo**: General

## Tablas Referenciadas
- [`saTarjetaCredito`](../tables/saTarjetaCredito.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarActualizarRegistrosTarjeta
*DESCRIPCIÓN	:	Inserta una tarjeta
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarActualizarRegistrosTarjeta]
    (
      @sCo_Tar			CHAR(6) ,
      @sCo_TarOri		CHAR(6) ,
      @sDes_Tar			VARCHAR(60) ,
      @sTelefono		VARCHAR(60) ,
      @deComision		DECIMAL(18, 5) ,
      @deImpuesto		DECIMAL(18, 5) ,
      @deRecargo		DECIMAL(18, 5) ,
      @sCampo1			VARCHAR(60)			= NULL ,
      @sCampo2			VARCHAR(60)			= NULL ,
      @sCampo3			VARCHAR(60)			= NULL ,
      @sCampo4			VARCHAR(60)			= NULL ,
      @sCampo5			VARCHAR(60)			= NULL ,
      @sCampo6			VARCHAR(60)			= NULL ,
      @sCampo7			VARCHAR(60)			= NULL ,
      @sCampo8			VARCHAR(60)			= NULL ,
      @sCampos			VARCHAR(MAX),		
      @sCo_us_in		CHAR(6) ,
      @sCo_sucu_in		CHAR(6)				= NULL ,
      @dFe_us_in		VARCHAR(60)			= NULL ,
      @sCo_us_mo		CHAR(6)				= NULL ,
      @sCo_sucu_mo		CHAR(6)				= NULL ,
      @sRevisado		CHAR(1) = '',
      @sTrasnfe			CHAR(1) = '',
      @sEmpresa			VARCHAR(60),
      @sMaquina			VARCHAR(60),
      @gRowguid			UNIQUEIDENTIFIER	= NULL
    )
AS 
    BEGIN
		
		DECLARE @sSql					NVARCHAR(4000) 
		DECLARE @tsValidador			TIMESTAMP
		DECLARE @sSqlValidador			NVARCHAR(200)
		
		SET @sSqlValidador = N'	SELECT @tsValidadorOUT = validador FROM  [' + @sempresa + '].[dbo].[saTarjetaCredito] WHERE Co_Tar = @sCo_Tar'  
		
		EXEC sp_executesql @query = @sSqlValidador, @params =	N'@tsValidadorOUT TIMESTAMP OUTPUT,		@sCo_Tar CHAR(6)',	
																@tsValidadorOUT = @tsValidador OUTPUT, @sCo_Tar = @sCo_Tar
																
		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pActualizarTarjetaCredito] 
																		@sCo_Tar,
																		@sCo_TarOri,
																		@sDes_Tar,
																		@sTelefono,
																		@deComision,
																		@deImpuesto,
																		@deRecargo,
																		@sCampo1,
																		@sCampo2,
																		@sCampo3,
																		@sCampo4,
																		@sCampo5,
																		@sCampo6,
																		@sCampo7,
																		@sCampo8,
																		@sCampos,
																		@sCo_us_mo,
																		@sCo_sucu_mo,
																		@sTrasnfe,
																		@sMaquina,
																		@s
```
