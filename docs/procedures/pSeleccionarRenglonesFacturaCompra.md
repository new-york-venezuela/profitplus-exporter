# SP: pSeleccionarRenglonesFacturaCompra
**Tipo**: Seleccionar
**Módulo**: Compras

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saFacturaCompraRengExt`](../tables/saFacturaCompraRengExt.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pSeleccionarRenglonesFacturaCompra] ( @sDoc_Num CHAR(20) )
AS 
    BEGIN 
        SELECT
            f.*, E.tasa, a.art_des, a.modelo, a.relac_unidad, a.co_lin, a.co_cat, a.rowguid AS rowguid_articulo,
            a.maneja_lote, a.maneja_lote_venc, a.maneja_serial, a.tipo_imp AS Tipo_Imp_Art, 
			ISNULL((SELECT CASE WHEN FCRE.credito_fiscal = '0' THEN 'NO Deducible (Art. 33)' 
								WHEN FCRE.credito_fiscal = '1' THEN 'Totalmente Deducible (Art. 34)'
								WHEN FCRE.credito_fiscal = '2' THEN 'Sujeto a Prorrateo (Art. 34)' ELSE '' END 
								FROM saFacturaCompraRengExt FCRE 
								WHERE FCRE.rowguid_reng = f.rowguid), '') AS credito_fiscal,
			a.tipo as Tipo_Articulo
        FROM
            saFacturaCompraReng f
            INNER JOIN saArticulo a ON ( f.co_art = a.co_art )
            INNER JOIN saFacturaCompra E ON E.doc_num = f.doc_num
        WHERE
            f.doc_num = @sDoc_Num
        ORDER BY
            reng_num ASC
    END
```
