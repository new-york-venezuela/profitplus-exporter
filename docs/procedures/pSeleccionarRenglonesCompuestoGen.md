# SP: pSeleccionarRenglonesCompuestoGen
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtCompuestoGen`](../tables/saArtCompuestoGen.md)
- [`saArtCompuestoGenReng`](../tables/saArtCompuestoGenReng.md)
- [`saArticulo`](../tables/saArticulo.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarRenglonesCompuestoGen
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarRenglonesCompuestoGen] ( @sGene_Num CHAR(20) )
AS 
    BEGIN

        SELECT
            g.*, e.tasa, a.art_des, a.maneja_lote, a.maneja_serial, a.rowguid AS RowGuid_Articulo, '1' as tipo_trans
        FROM
            saArtCompuestoGenReng g
            INNER JOIN saArticulo a ON g.co_art = a.co_art
            INNER JOIN saArtCompuestoGen E ON E.gene_num = g.gene_num
        WHERE
            g.gene_num = @sGene_Num
        ORDER BY
            reng_num ASC

    END
```
