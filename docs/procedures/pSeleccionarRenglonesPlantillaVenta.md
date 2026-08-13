# SP: pSeleccionarRenglonesPlantillaVenta
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saPlantillaVenta`](../tables/saPlantillaVenta.md)
- [`saPlantillaVentaReng`](../tables/saPlantillaVentaReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE			: pSeleccionarRenglonesPlanillaVenta
DESCRIPCION		: Selecciona los renglones de una plantilla de venta
CREADO POR		: SOFTECH SISTEMAS
FECHA			: 26/05/2010
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarRenglonesPlantillaVenta] ( @sDoc_Num CHAR(20) )
AS 
    BEGIN 
        SELECT
            f.*, E.tasa, a.art_des, a.modelo, a.relac_unidad, a.co_lin, a.co_cat, a.rowguid AS rowguid_articulo,
            a.maneja_lote, a.maneja_lote_venc, a.maneja_serial, a.tipo_imp AS Tipo_Imp_Art
        FROM
            saPlantillaVentaReng f
            INNER JOIN saArticulo a ON ( f.co_art = a.co_art )
            INNER JOIN saPlantillaVenta E ON E.doc_num = f.doc_num
        WHERE
            f.doc_num = @sDoc_Num
        ORDER BY
            reng_num ASC
    END
```
