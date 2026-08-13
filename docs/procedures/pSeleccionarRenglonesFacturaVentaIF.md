# SP: pSeleccionarRenglonesFacturaVentaIF
**Tipo**: Seleccionar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarRenglonesFacturaVentaIF 
DESCRIPCION: Procedimiento para seleccionar los renglones de venta
CREADO POR		:	SOFTECH SISTEMAS
MODIFICADO POR	:	SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarRenglonesFacturaVentaIF] ( @sDoc_Num CHAR(20) )
AS 
    BEGIN 
        SELECT
            f.*, E.tasa, 
			CASE 
				WHEN a.generico = 1 AND ISNULL(LTRIM(RTRIM(f.des_art)), '') <> '' THEN f.des_art
				WHEN a.generico = 1 THEN a.art_des
				ELSE dbo.FactArtDescCustomIF(a.art_des , f.rowguid) 
			END
			
			as art_des, a.modelo,  a.ref ,  a.relac_unidad, a.co_lin, a.co_cat, a.rowguid AS rowguid_articulo,
            a.maneja_lote, a.maneja_lote_venc, a.maneja_serial, a.tipo_imp AS Tipo_Imp_Art,
            ROUND(dbo.CalcularMontoPorcentaje(f.porc_desc, f.prec_vta, 1) * 100 / f.prec_vta, 2) AS Porc_real,'S' as co_tipo
        FROM
            saFacturaVentaReng f
            INNER JOIN saArticulo a ON ( f.co_art = a.co_art )
            INNER JOIN saFacturaVenta E ON E.doc_num = f.doc_num
        WHERE
            f.doc_num = @sDoc_Num
        ORDER BY
            reng_num ASC
    END
```
