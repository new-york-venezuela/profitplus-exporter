# SP: pValidarLoteSalidaNoOrigen
**Tipo**: Validar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saAjuste`](../tables/saAjuste.md)
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saArtCompuestoGen`](../tables/saArtCompuestoGen.md)
- [`saArtCompuestoGenReng`](../tables/saArtCompuestoGenReng.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saDevolucionProveedor`](../tables/saDevolucionProveedor.md)
- [`saDevolucionProveedorReng`](../tables/saDevolucionProveedorReng.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saLoteSalida`](../tables/saLoteSalida.md)
- [`saNotaEntregaVenta`](../tables/saNotaEntregaVenta.md)
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)
- [`saNotaRecepcionCompra`](../tables/saNotaRecepcionCompra.md)
- [`saNotaRecepcionCompraReng`](../tables/saNotaRecepcionCompraReng.md)
- [`saTraslado`](../tables/saTraslado.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pValidarLoteSalidaNoOrigen]
    (
      @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
      @IdProcess UNIQUEIDENTIFIER
    )
AS 
    BEGIN	
	
        DECLARE @ValStatusResult TABLE ( Motivo VARCHAR(512) )

        DECLARE CURSOR_VALIDAR CURSOR LOCAL FAST_FORWARD
        FOR
            SELECT
                L.rowguid,
                'El lote de salida "' + RTRIM(L.numero_lote) + '" renglon "' + LTRIM(RTRIM(STR(reng_num)))
                + '" no posee el documento tipo "' + RTRIM(l.tipo_doc) + '" asociado ('
                + RTRIM(CONVERT(VARCHAR(64), L.rowguid_reng)) + ')' AS motivo
            FROM
                saLoteSalida L
            WHERE
                L.tipo_doc IN ( 'AJUE', 'AJUS' )
                AND NOT EXISTS ( SELECT
                                    *
                                 FROM
                                    saAjusteReng R
                                    INNER JOIN saAjuste E ON E.ajue_num = R.ajue_num
                                 WHERE
                                    R.rowguid = L.rowguid_reng
                                    AND e.anulado = 0 )
            UNION
            SELECT
                L.rowguid,
                'El lote de salida "' + RTRIM(L.numero_lote) + '" renglon "' + LTRIM(RTRIM(STR(reng_num)))
                + '" no posee el documento tipo "' + RTRIM(l.tipo_doc) + '" asociado ('
                + RTRIM(CONVERT(VARCHAR(64), L.rowguid_reng)) + ')' AS motivo
            FROM
                saLoteSalida L
            WHERE
                L.tipo_doc IN ( 'TRAE', 'TRAS' )
                AND NOT EXISTS ( SELECT
                                    *
                                 FROM
                                    saTrasladoReng R
                                    INNER JOIN saTraslado E ON E.tras_num = R.tras_num
                                 WHERE
                                    R.rowguid = L.rowguid_reng
                                    AND E.anulado = 0 )
            UNION
            SELECT
                L.rowguid,
                'El lote de salida "' + RTRIM(L.numero_lote) + '" renglon "' + LTRIM(RTRIM(STR(reng_num)))
                + '" no posee el documento tipo GCOR asociado ('
                + RTRIM(CONVERT(VARCHAR(64), L.rowguid_reng)) + ')' AS motivo
            FROM
                saLoteSalida L
            WHERE
                L.tipo_doc = 'GC
```
