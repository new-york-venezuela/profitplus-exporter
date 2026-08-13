# SP: pSeleccionarRenglonesOrdenCompra
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saOrdenCompra`](../tables/saOrdenCompra.md)
- [`saOrdenCompraReng`](../tables/saOrdenCompraReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE			:	pSeleccionarRenglonesNotaRecepcionCompra
DESCRIPCION		:	Procedimiento para seleccionar los renglones de compra
CREADO POR		:	SOFTECH SISTEMAS
MODIFICADO POR	:	SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarRenglonesOrdenCompra] ( @sDoc_Num CHAR(20) )
AS 
    BEGIN 
        SELECT
            f.*, E.tasa, a.art_des, a.modelo, a.relac_unidad, a.co_lin, a.co_cat, a.rowguid AS rowguid_articulo,
            a.maneja_lote, a.maneja_lote_venc, a.maneja_serial, a.tipo_imp AS Tipo_Imp_Art
        FROM
            saOrdenCompraReng f
            INNER JOIN saArticulo a ON ( f.co_art = a.co_art )
            INNER JOIN saOrdenCompra E ON E.doc_num = f.doc_num
        WHERE
            f.doc_num = @sDoc_Num
        ORDER BY
            reng_num ASC
    END
```
