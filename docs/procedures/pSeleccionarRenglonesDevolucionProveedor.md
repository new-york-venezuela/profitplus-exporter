# SP: pSeleccionarRenglonesDevolucionProveedor
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saDevolucionProveedor`](../tables/saDevolucionProveedor.md)
- [`saDevolucionProveedorReng`](../tables/saDevolucionProveedorReng.md)
- [`saDevolucionProveedorRengExt`](../tables/saDevolucionProveedorRengExt.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pSeleccionarRenglonesDevolucionProveedor] ( @sDoc_Num CHAR(20) )
AS 
    BEGIN 
        SELECT
            f.*, E.tasa, a.art_des, a.modelo, a.relac_unidad, a.co_lin, a.co_cat, a.rowguid AS rowguid_articulo,
            a.maneja_lote, a.maneja_lote_venc, a.maneja_serial, a.tipo_imp AS Tipo_Imp_Art,co_tipo='S',
			ISNULL((SELECT CASE WHEN DPRE.credito_fiscal = '0' THEN 'NO Deducible (Art. 33)' 
								WHEN DPRE.credito_fiscal = '1' THEN 'Totalmente Deducible (Art. 34)'
								WHEN DPRE.credito_fiscal = '2' THEN 'Sujeto a Prorrateo (Art. 34)' ELSE '' END 
								FROM saDevolucionProveedorRengExt DPRE 
								WHERE DPRE.rowguid_reng = f.rowguid), '') AS credito_fiscal
        FROM
            saDevolucionProveedorReng f
            INNER JOIN saArticulo a ON ( f.co_art = a.co_art )
            INNER JOIN saDevolucionProveedor E ON E.doc_num = f.doc_num
        WHERE
            f.doc_num = @sDoc_Num
        ORDER BY
            reng_num ASC
    END
```
