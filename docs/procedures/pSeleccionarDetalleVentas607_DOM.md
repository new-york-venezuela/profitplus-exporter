# SP: pSeleccionarDetalleVentas607_DOM
**Tipo**: Seleccionar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saCobro`](../tables/saCobro.md)
- [`saCobroDocReng`](../tables/saCobroDocReng.md)
- [`saCobroRetenIvaReng`](../tables/saCobroRetenIvaReng.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saNCFInfoDocVenta`](../tables/saNCFInfoDocVenta.md)
- [`saSerie`](../tables/saSerie.md)
- [`saSerieTipo`](../tables/saSerieTipo.md)
- [`saSerieTipoExt`](../tables/saSerieTipoExt.md)
- [`saTipoComprobante`](../tables/saTipoComprobante.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		<Softech Sistemas>
-- Create date: <21/06/2019>
-- Description:	<Extractor Detalle de Ventas 607>
-- =============================================
--EXEC pSeleccionarDetalleVentas607_DOM '2031-06-01', '2031-06-30', '0', '999999', '0', '99', '01', '03'
CREATE PROCEDURE [dbo].[pSeleccionarDetalleVentas607_DOM]
	  @fechad AS   DATETIME
	, @fechah AS   DATETIME
	, @tipo_ingd AS CHAR(1) = NULL
	, @tipo_ingh AS CHAR(1) = NULL
	, @tipo_comprobd AS CHAR(20) = NULL
	, @tipo_comprobh AS CHAR(20) = NULL
	, @co_sucuD as char(6) = NULL
	, @co_sucuH as char(6) = NULL
AS
	BEGIN
	SET NOCOUNT ON;
	
    -- IF @fechah IS NOT NULL
    --     SET @fechah = DATEADD(ss, -60, DATEADD(day, 1, @fechah))
    
    DECLARE @dtDesde DATETIME, @dtHasta DATETIME
    SET @dtDesde = @fechad
    SET @dtHasta = @fechah
    
    ---------------------------------------------------------------------------------------------------------------------------------------
    DECLARE @todosIng BIT
        ,@todosComp BIT
        ,@todasSucu BIT

    SET @tipo_ingd = COALESCE(@tipo_ingd, '')
    SET @tipo_ingh = COALESCE(@tipo_ingh, '')
    SET @tipo_comprobd = COALESCE(@tipo_comprobd, '')
    SET @tipo_comprobh = COALESCE(@tipo_comprobh, '')
    SET @co_sucuD = COALESCE(@co_sucuD, '')
    SET @co_sucuH = COALESCE(@co_sucuH, '')
        
    SET @todosIng = (CASE WHEN @tipo_ingd <> '' THEN
        CASE WHEN @tipo_ingh <> '' THEN 0 ELSE 1 END
        ELSE 1 END)
        
    SET @todosComp = (CASE WHEN @tipo_comprobd <> '' THEN
        CASE WHEN @tipo_comprobh <> '' THEN 0 ELSE 1 END
        ELSE 1 END)
    
    SET @todasSucu = (CASE WHEN @co_sucuD <> '' THEN
        CASE WHEN @co_sucuH <> '' THEN 0 ELSE 1 END
        ELSE 1 END)
    ---------------------------------------------------------------------------------------------------------------------------------------

	BEGIN --Generacion Resumen de Cobros 

		DECLARE @CobrosDoc TABLE
		(
			  fecha					DATETIME --SMALLDATETIME
			, nro_doc				CHAR(20)
			, co_cli				CHAR(16)
			, cli_des				VARCHAR(100)
			, tipo_doc				CHAR(6)
			, cob_num				CHAR(20)
			, tipo_origen			CHAR(6)
			, tipo					CHAR(6)
			, porcion_cobro_doc		DECIMAL(18, 2)
			, ncf					VARCHAR(20)
			, co_tipo_ncf			CHAR(10)
			, nom_tipo_ncf			VARCHAR(60)
			, monto_documento		DECIMAL(18, 2)
			, por_cobrar			DECIMAL(18, 2)
			, grupo					CHAR(50)
			, fec_c
```
