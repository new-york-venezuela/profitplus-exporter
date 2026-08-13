# SP: pCostoActualizarEntrada
**Tipo**: Procedimiento
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjuste`](../tables/saAjuste.md)
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saArtCompuesto`](../tables/saArtCompuesto.md)
- [`saArtCompuestoGen`](../tables/saArtCompuestoGen.md)
- [`saArtCompuestoGenReng`](../tables/saArtCompuestoGenReng.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saNotaRecepcionCompra`](../tables/saNotaRecepcionCompra.md)
- [`saNotaRecepcionCompraReng`](../tables/saNotaRecepcionCompraReng.md)
- [`saTipoAjuste`](../tables/saTipoAjuste.md)
- [`saTraslado`](../tables/saTraslado.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pCostoActualizarEntrada] 
	@RowGuid_Doc_Orig UNIQUEIDENTIFIER
	,@strTipo_doc CHAR(4)
AS
BEGIN
	SET NOCOUNT ON;

	DECLARE @tablaGenerica TABLE (
		RowGuid_Art UNIQUEIDENTIFIER
		,Cod_Almacen CHAR(6)
		,Fecha_Doc DATETIME
		,Fecha_Us_In DATETIME
		,Total_Art DECIMAL(18, 5)
		,Costo_Reng DECIMAL(18, 5)
		,Pk_Co_Art CHAR(30)
		,Co_Uni CHAR(6)
		,iRengNumActual INT
		,Tipo_Doc CHAR(4)
		)
	DECLARE @RowGuid_Art UNIQUEIDENTIFIER
	DECLARE @Cod_Almacen CHAR(6)
	DECLARE @Fecha_Doc DATETIME
	DECLARE @Fecha_Us_In DATETIME
	DECLARE @Total_Art DECIMAL(18, 5)
	DECLARE @Total_ArtUniPrim DECIMAL(18, 5)
	DECLARE @Costo_Reng DECIMAL(18, 5)
	DECLARE @Pk_Co_Art CHAR(30)
	DECLARE @Co_Uni CHAR(6)
	DECLARE @iRengNumActual INT

	IF (@strTipo_doc = 'AJUS') --AJUSTES DE ENTRADA
	BEGIN
		INSERT INTO @tablaGenerica (
			RowGuid_Art
			,Cod_Almacen
			,Total_Art
			,Fecha_Doc
			,Fecha_Us_In
			,Costo_Reng
			,iRengNumActual
			,Pk_Co_Art
			,Co_Uni
			,Tipo_Doc
			)
		SELECT saArticulo.rowguid
			,saAjusteReng.co_alma
			,saAjusteReng.total_art
			,saAjuste.fecha
			,saAjuste.fe_us_in
			,saAjusteReng.cost_unit + saAjusteReng.costo_adi1 + saAjusteReng.costo_adi2 + saAjusteReng.costo_adi3 AS cos_unit
			,saAjusteReng.reng_num
			,saAjusteReng.co_art
			,saAjusteReng.co_uni
			,'AJUS'
		FROM saAjusteReng
		INNER JOIN saArticulo ON saArticulo.co_Art = saAjusteReng.co_art
		INNER JOIN saAjuste ON saAjuste.ajue_num = saAjusteReng.ajue_num
			AND saAjuste.anulado = 0
		INNER JOIN saTipoAjuste ON saTipoAjuste.tipo_trans = '0'
			AND saTipoAjuste.co_tipo = saAjusteReng.co_tipo
		WHERE saAjusteReng.rowguid = @RowGuid_Doc_Orig
	END
	ELSE IF (@strTipo_doc = 'TRAT') --TRASLADO ENTRE ALMACENES
	BEGIN
		INSERT INTO @tablaGenerica (
			RowGuid_Art
			,Cod_Almacen
			,Total_Art
			,Fecha_Doc
			,Fecha_Us_In
			,Costo_Reng
			,iRengNumActual
			,Pk_Co_Art
			,Co_Uni
			,Tipo_Doc
			)
		-- Ingreso en Almacen Temporal
		SELECT saArticulo.rowguid
			,saTraslado.alm_tmp
			,saTrasladoReng.total_art
			,saTraslado.fec_sal
			,saTrasladoReng.fe_us_in
			,saTrasladoReng.cost_unit AS cost_unit
			,saTrasladoReng.reng_num
			,saTrasladoReng.co_art
			,saTrasladoReng.co_uni
			,'TRAT'
		FROM saTrasladoReng
		INNER JOIN saArticulo ON saArticulo.co_Art = saTrasladoReng.co_art
		INNER JOIN saTraslado ON saTraslado.tras_num = saTrasladoReng.tras_num
			AND saTraslado.anulado = 0
		WHERE saTrasladoReng.
```
