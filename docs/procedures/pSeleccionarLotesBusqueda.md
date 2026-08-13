# SP: pSeleccionarLotesBusqueda
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saAjuste`](../tables/saAjuste.md)
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saArtCompuestoGen`](../tables/saArtCompuestoGen.md)
- [`saArtCompuestoGenReng`](../tables/saArtCompuestoGenReng.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saLoteEntrada`](../tables/saLoteEntrada.md)
- [`saNotaRecepcionCompra`](../tables/saNotaRecepcionCompra.md)
- [`saNotaRecepcionCompraReng`](../tables/saNotaRecepcionCompraReng.md)
- [`saTraslado`](../tables/saTraslado.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			: pSeleccionarLotesBusquedaPorPrecio
*DESCRIPCIÓN	: Selecciona los lotes de entrada asociados a un renglón de proceso de venta (de acuerdo a su precio) 
				  y devuelve duplas conformadas por la clave del lote y la cantidad que debe ser tomada del mismo.
*AUTOR			: Softech Sistemas
************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarLotesBusqueda]
	(
		@sCo_Alma CHAR(6) ,
		@sCo_Art CHAR(30) ,
		@dTotal_Art DECIMAL(18, 5) ,
		@sCo_Uni CHAR(6) ,
		@dPrecio DECIMAL(18, 5) ,
		@dPorcentaje_Maximo_Ganancia DECIMAL(18, 5) ,
		@bMargen_Ganancia_Costo_A_Precio CHAR(1) ,
		@bPermitir_Lotes_Vencidos CHAR(1) ,
		@sdFec_Emis_Doc_Salida SMALLDATETIME
    )
AS
	BEGIN
		SET NOCOUNT ON;

		DECLARE @TipoCosto CHAR(1)
 
		SELECT 
			@TipoCosto = i_costo_inventario 
		FROM 
			par_emp

		-- COSTO PROMEDIO CALCULA PEPS (TIPO COSTO '2')
		IF @TipoCosto <> '2' AND @TipoCosto <> '3'
			SET @TipoCosto = '2'

		SET @dTotal_Art = dbo.ArtUnidadBase(@sCo_Art, @sCo_Uni, @dTotal_Art)

        DECLARE @t TABLE
			(
				Id UNIQUEIDENTIFIER ,
				Nombre_Lote CHAR(20) ,
				Rowguid_Reng_Doc_Entrada UNIQUEIDENTIFIER ,
				Stock_Actual DECIMAL(18, 5) , 
				Cantidad_A_Tomar DECIMAL(18, 5)
			)
		
		DECLARE @LotesEntrada TABLE
			(
				Id UNIQUEIDENTIFIER ,
				Nombre_Lote CHAR(20) ,
				Rowguid_Reng_Doc_Entrada UNIQUEIDENTIFIER ,
				Stock_Actual DECIMAL(18, 5) ,
				Fecha SMALLDATETIME ,
				Nro_Reng INT ,
				Nro_Lote INT
			)

		INSERT INTO @LotesEntrada
				( Id,  Nombre_Lote, Rowguid_Reng_Doc_Entrada, Stock_Actual, Fecha, Nro_Reng, Nro_Lote )
            SELECT
                LE.rowguid AS Id, LE.numero_lote AS Nombre_Lote, rowguid_reng AS Rowguid_Reng_Doc_Entrada, LE.stock_actual AS Stock_Actual, FC.fec_emis AS Fecha, FCR.reng_num AS Nro_Reng,
				LE.reng_num AS Nro_lote
            FROM
                saLoteEntrada AS LE
				INNER JOIN saArticulo AS A ON A.co_art = LE.co_art
				INNER JOIN saFacturaCompraReng AS FCR ON FCR.rowguid = LE.rowguid_reng
				INNER JOIN saFacturaCompra AS FC ON FC.doc_num = FCR.doc_num AND FC.anulado = 0
				INNER JOIN saCostoHistoricoEntrada AS CHE ON CHE.tipo_doc = 'COMP' AND CHE.doc_orig = FCR.rowguid
            WHERE
				LE.tipo_doc = 'COMP'
                AND LE.co_art = @sCo_Art
                AND LE.co_alma = @sCo_Alma
                --
```
