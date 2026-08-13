# SP: pSeleccionarRenglonesPedidoVenta
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saPedidoVenta`](../tables/saPedidoVenta.md)
- [`saPedidoVentaReng`](../tables/saPedidoVentaReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarRenglonesPedidoVenta
DESCRIPCION: Selecciona los renglones de un Pedido de venta
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarRenglonesPedidoVenta] ( @sDoc_Num CHAR(20) )
AS 
    BEGIN 
        SELECT
            f.*, E.tasa, a.art_des, a.modelo, a.relac_unidad, a.co_lin, a.co_cat, a.rowguid AS rowguid_articulo,
            a.maneja_lote, a.maneja_lote_venc, a.maneja_serial, a.tipo_imp AS Tipo_Imp_Art
        FROM
            saPedidoVentaReng f
            INNER JOIN saArticulo a ON ( f.co_art = a.co_art )
            INNER JOIN saPedidoVenta E ON E.doc_num = f.doc_num
        WHERE
            f.doc_num = @sDoc_Num
        ORDER BY
            reng_num ASC
    END
```
