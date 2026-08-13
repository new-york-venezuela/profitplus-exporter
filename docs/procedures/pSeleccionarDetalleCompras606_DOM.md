# SP: pSeleccionarDetalleCompras606_DOM
**Tipo**: Seleccionar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDevolucionProveedor`](../tables/saDevolucionProveedor.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saNCFInfoDocCompra`](../tables/saNCFInfoDocCompra.md)
- [`saPago`](../tables/saPago.md)
- [`saPagoDocReng`](../tables/saPagoDocReng.md)
- [`saPagoRentenReng`](../tables/saPagoRentenReng.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saSerie`](../tables/saSerie.md)
- [`saSerieTipo`](../tables/saSerieTipo.md)
- [`saSerieTipoExt`](../tables/saSerieTipoExt.md)
- [`saTabuladorIslr`](../tables/saTabuladorIslr.md)
- [`saTabuladorIslrReng`](../tables/saTabuladorIslrReng.md)
- [`saTipoComprobante`](../tables/saTipoComprobante.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		<Author,,Name>
-- Create date: <Create Date,,>
-- Description:	<Description,,>
-- =============================================
CREATE PROCEDURE [dbo].[pSeleccionarDetalleCompras606_DOM]
	  @fechad AS   DATETIME
	, @fechah AS   DATETIME
	, @tipo_fact AS CHAR(1) = NULL
	, @tipo_retd AS CHAR(1) = NULL
	, @tipo_reth AS CHAR(1) = NULL
	, @tipo_fpagod AS CHAR(1) = NULL
	, @tipo_fpagoh AS CHAR(1) = NULL
	, @tipo_comprobd AS CHAR(20) = NULL
	, @tipo_comprobh AS CHAR(20) = NULL
	, @co_sucuD as char(6) = NULL
	, @co_sucuH as char(6) = NULL
AS
	BEGIN
	SET NOCOUNT ON;
	
		IF @fechah IS NOT NULL
            SET @fechah = DATEADD(ss, -60, DATEADD(day, 1, @fechah))

		IF @tipo_fpagoh IS NULL
		   SELECT @tipo_fpagoh = '9'
		
		DECLARE @dtDesde DATETIME, @dtHasta DATETIME
		SET @dtDesde = @fechad
		SET @dtHasta = @fechah
		
		----------------------------------------------------------------------------------------------------------------------
			
		DECLARE @todasRet BIT
			,@todosPag BIT
			,@todosComp BIT
			,@todasSucu BIT

		SET @tipo_fact = COALESCE(@tipo_fact, '')
		SET @tipo_retd = COALESCE(@tipo_retd, '')
		SET @tipo_reth = COALESCE(@tipo_reth, '')
		SET @tipo_fpagod = COALESCE(@tipo_fpagod, '')
		SET @tipo_fpagoh = COALESCE(@tipo_fpagoh, '')
		SET @tipo_comprobd = COALESCE(@tipo_comprobd, '')
		SET @tipo_comprobh = COALESCE(@tipo_comprobh, '')
		SET @co_sucuD = COALESCE(@co_sucuD, '')
		SET @co_sucuH = COALESCE(@co_sucuH, '')
		
		SET @todasRet = (CASE WHEN @tipo_retd <> '' THEN
			CASE WHEN @tipo_reth <> '' THEN 0 ELSE 1 END
			ELSE 1 END)
			
		SET @todosPag = (CASE WHEN @tipo_fpagod <> '' THEN
			CASE WHEN @tipo_fpagoh <> '' THEN 0 ELSE 1 END
			ELSE 1 END)
			
		SET @todosComp = (CASE WHEN @tipo_comprobd <> '' THEN
			CASE WHEN @tipo_comprobh <> '' THEN 0 ELSE 1 END
			ELSE 1 END)
		
		SET @todasSucu = (CASE WHEN @co_sucuD <> '' THEN
			CASE WHEN @co_sucuH <> '' THEN 0 ELSE 1 END
			ELSE 1 END)
		---------------------------------------------------------------------------------------------------------------------------------------

	BEGIN --Generacion Resumen de Pagos 

		DECLARE @PagosDoc TABLE
		(
			  fecha            SMALLDATETIME
			, nro_doc          CHAR(20)
			, co_cli           CHAR(16)
			, prov_des         VARCHAR(100)
			, tipo_doc         CHAR(6)
			, cob_num          CHAR(20)
			, tipo_origen      CHAR(6)
			,
```
