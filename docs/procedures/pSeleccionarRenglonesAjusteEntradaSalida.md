# SP: pSeleccionarRenglonesAjusteEntradaSalida
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjuste`](../tables/saAjuste.md)
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saTipoAjuste`](../tables/saTipoAjuste.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarRenglonesAjuste
DESCRIPCION: Selecciona los renglones asociados a  saAjusteReng
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarRenglonesAjusteEntradaSalida] ( @sAjue_Num CHAR(20) )
AS 
    BEGIN
        SELECT
            r.*, a.art_des, a.modelo, a.maneja_lote, a.maneja_lote_venc, a.maneja_serial, a.relac_unidad,
            a.rowguid AS RowGuid_Articulo, t.tipo_trans, E.tasa
        FROM
            saAjusteReng r
            INNER JOIN saArticulo a ON ( r.co_art = a.co_art )
            INNER JOIN saTipoAjuste t ON ( r.co_tipo = t.co_tipo )
            INNER JOIN saAjuste E ON E.ajue_num = R.ajue_num
        WHERE
            r.ajue_num = @sAjue_Num
        ORDER BY
            r.reng_num ASC
    END
```
