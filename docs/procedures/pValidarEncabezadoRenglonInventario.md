# SP: pValidarEncabezadoRenglonInventario
**Tipo**: Validar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saAjuste`](../tables/saAjuste.md)
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saArtCompuesto`](../tables/saArtCompuesto.md)
- [`saArtCompuestoGen`](../tables/saArtCompuestoGen.md)
- [`saArtCompuestoGenReng`](../tables/saArtCompuestoGenReng.md)
- [`saArtCompuestoReng`](../tables/saArtCompuestoReng.md)
- [`saCotizacionCliente`](../tables/saCotizacionCliente.md)
- [`saCotizacionClienteReng`](../tables/saCotizacionClienteReng.md)
- [`saCotizacionProveedor`](../tables/saCotizacionProveedor.md)
- [`saCotizacionProveedorReng`](../tables/saCotizacionProveedorReng.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saDevolucionProveedor`](../tables/saDevolucionProveedor.md)
- [`saDevolucionProveedorReng`](../tables/saDevolucionProveedorReng.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saNotaDespachoVenta`](../tables/saNotaDespachoVenta.md)
- [`saNotaDespachoVentaReng`](../tables/saNotaDespachoVentaReng.md)
- [`saNotaEntregaVenta`](../tables/saNotaEntregaVenta.md)
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)
- [`saNotaRecepcionCompra`](../tables/saNotaRecepcionCompra.md)
- [`saNotaRecepcionCompraReng`](../tables/saNotaRecepcionCompraReng.md)
- [`saOrdenCompra`](../tables/saOrdenCompra.md)
- [`saOrdenCompraReng`](../tables/saOrdenCompraReng.md)
- [`saPedidoVenta`](../tables/saPedidoVenta.md)
- [`saPedidoVentaReng`](../tables/saPedidoVentaReng.md)
- [`saPlantillaCompra`](../tables/saPlantillaCompra.md)
- [`saPlantillaCompraReng`](../tables/saPlantillaCompraReng.md)
- [`saPlantillaVenta`](../tables/saPlantillaVenta.md)
- [`saPlantillaVentaReng`](../tables/saPlantillaVentaReng.md)
- [`saResInventario`](../tables/saResInventario.md)
- [`saResInventarioReng`](../tables/saResInventarioReng.md)
- [`saTraslado`](../tables/saTraslado.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pValidarEncabezadoRenglonInventario]
	(
      @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
      @IdProcess UNIQUEIDENTIFIER
    )
AS 
    BEGIN
        DECLARE @ValStatusResult TABLE ( Motivo VARCHAR(384) )
	
        INSERT  INTO @ValStatusResult
                SELECT
                    'La definición del articulo compuesto ''' + RTRIM(E.co_artc)
                    + ''' no posee renglones (saArtCompuestoReng).' AS Motivo
                FROM
                    saArtCompuesto E
                WHERE
                    NOT EXISTS ( SELECT
                                    *
                                 FROM
                                    saArtCompuestoReng R
                                 WHERE
                                    E.co_artc = R.co_artc )
                UNION
                SELECT
                    'La plantilla de venta ''' + RTRIM(E.DOC_NUM) + ''' no posee renglones (saPlantillaVentaReng).' AS Motivo
                FROM
                    saPlantillaVenta E
                WHERE
                    NOT EXISTS ( SELECT
                                    *
                                 FROM
                                    saPlantillaVentaReng R
                                 WHERE
                                    E.DOC_NUM = R.DOC_NUM )
                UNION
                SELECT
                    'La cotizacion de cliente ''' + RTRIM(E.DOC_NUM)
                    + ''' no posee renglones (saCotizacionClienteReng).' AS Motivo
                FROM
                    saCotizacionCliente E
                WHERE
                    NOT EXISTS ( SELECT
                                    *
                                 FROM
                                    saCotizacionClienteReng R
                                 WHERE
                                    E.DOC_NUM = R.DOC_NUM )
                UNION
                SELECT
                    'El pedido ''' + RTRIM(E.DOC_NUM) + ''' no posee renglones (saPedidoVentaReng).' AS Motivo
                FROM
                    saPedidoVenta E
                WHERE
                    NOT EXISTS ( SELECT
                                    *
                                 FROM
                                    saPedidoVentaReng R
                                 WHERE
                                    E.DOC_NUM = R.DOC_NUM )
                UNIO
```
