# SP: pSeleccionarFormasPagoDocumentoCompraOM
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saNCFInfoDocCompra`](../tables/saNCFInfoDocCompra.md)
- [`saPago`](../tables/saPago.md)
- [`saPagoDocReng`](../tables/saPagoDocReng.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saSerie`](../tables/saSerie.md)
- [`saSerieTipo`](../tables/saSerieTipo.md)
- [`saSerieTipoExt`](../tables/saSerieTipoExt.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		<Author,,Name>
-- Create date: <Create Date,,>
-- Description:	<Description,,>
-- =============================================
CREATE PROCEDURE [dbo].[pSeleccionarFormasPagoDocumentoCompraOM] 

	-- Add the parameters for the stored procedure here
	 @dDesde_d    SMALLDATETIME
	, @dDesde_h    SMALLDATETIME
	, @sDocDesde_d CHAR(20) = NULL
	, @sDocDesde_h CHAR(20) = NULL
	, @sCobDesde_d CHAR(20) = NULL
	, @sCobDesde_h CHAR(20) = NULL
	, @sCliente_d  CHAR(10) = NULL
	, @sCliente_h CHAR(10) = NULL
	, @sTipoComp_d CHAR(2)  = NULL
	, @sTipoComp_h CHAR(2)  = NULL
	, @sCosucu     CHAR(20) = NULL
	, @sCo_Moneda_Rep   CHAR (6) = NULL
	, @sCo_Moneda   CHAR (6) = NULL
	, @sCampOrderBy VARCHAR(16) = NULL 
    , @sDir VARCHAR(6) = NULL

	AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

  
    -- Insert statements for procedure here
	SELECT @dDesde_h = DATEADD(MINUTE, -1, DATEADD(DAY, 1, @dDesde_h))

    ---------------------------------------------------------------------------------------------------------------------------------------
	DECLARE @todosDocu BIT
		,@todosCob BIT
		,@todosClie BIT
		,@todosComp BIT
		,@todasSucu BIT
-->wosuna comentado ya que cuando hay numero de facturas y numeros de cobros con letras el reporte falla
	--SET @sDocDesde_d = COALESCE(@sDocDesde_d, '')
	--SET @sDocDesde_h = COALESCE(@sDocDesde_h, '')
	--SET @sCobDesde_d = COALESCE(@sCobDesde_d, '')
	--SET @sCobDesde_h = COALESCE(@sCobDesde_h, '')
--<wosuna

	SET @sCliente_d = COALESCE(@sCliente_d, '')
	SET @sCliente_h = COALESCE(@sCliente_h, '')
	SET @sTipoComp_d = COALESCE(@sTipoComp_d, '')
	SET @sTipoComp_h = COALESCE(@sTipoComp_h, '')
	SET @sCosucu = COALESCE(@sCosucu, '')
	
-->wosuna comentado ya que cuando hay numero de facturas y numeros de cobros con letras el reporte falla
	--SET @todosDocu = (CASE WHEN @sDocDesde_d <> '' THEN
	--	CASE WHEN @sDocDesde_h <> '' THEN 0 ELSE 1 END
	--	ELSE 1 END)
		
	--SET @todosCob = (CASE WHEN @sCobDesde_d <> '' THEN
	--	CASE WHEN @sCobDesde_h <> '' THEN 0 ELSE 1 END
	--	ELSE 1 END)
--<wosuna
	SET @todosClie = (CASE WHEN @sCliente_d <> '' THEN
		CASE WHEN @sCliente_h <> '' THEN 0 ELSE 1 END
		ELSE 1 END)
	
	SET @todosComp = (CASE WHEN @sTipoComp_d <> '' THEN
		CASE WHEN @sTipoComp_h <> '' THEN 0 ELSE 1 END
		ELSE 1 END)
		
	SET @todasSucu = (CASE WH
```
