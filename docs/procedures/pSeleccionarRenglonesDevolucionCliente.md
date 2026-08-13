# SP: pSeleccionarRenglonesDevolucionCliente
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarRenglonesDevolucionVenta
DESCRIPCION: Selecciona los renglones de una Devolucion de venta
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarRenglonesDevolucionCliente] ( @sDoc_Num CHAR(20) )
AS 
    BEGIN 
        SELECT
            f.*, E.tasa, a.art_des, a.modelo, a.ref , a.relac_unidad, a.co_lin, a.co_cat, a.rowguid AS rowguid_articulo,
            a.maneja_lote, a.maneja_lote_venc, a.maneja_serial, a.tipo_imp AS Tipo_Imp_Art,
            ROUND(dbo.CalcularMontoPorcentaje(f.porc_desc, f.prec_vta, 1) * 100 / f.prec_vta, 2) AS Porc_real
        FROM
            saDevolucionClienteReng f
            INNER JOIN saArticulo a ON ( f.co_art = a.co_art )
            INNER JOIN saDevolucionCliente E ON E.doc_num = f.doc_num
        WHERE
            f.doc_num = @sDoc_Num
        ORDER BY
            reng_num ASC
    END
```
