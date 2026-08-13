# SP: pSeleccionarRenglonesTraslado
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saTraslado`](../tables/saTraslado.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarRenglonesTraslado
DESCRIPCION: Busca los renglones segun el código del padre asociado
CREADO POR: SOFTECH
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarRenglonesTraslado] ( @sTras_Num CHAR(20) )
AS 
    BEGIN
        SELECT
            r.*, e.tasa, a.art_des, a.modelo, a.maneja_lote, a.maneja_lote_venc, a.maneja_serial, a.fecha_reg,
            a.rowguid AS RowGuid_Articulo
        FROM
            saTrasladoReng r
            INNER JOIN saTraslado E ON r.tras_num = e.tras_num
            INNER JOIN saArticulo a ON r.co_art = a.co_art
        WHERE
            r.tras_num = @sTras_Num
        ORDER BY
            r.reng_num ASC
    END
```
