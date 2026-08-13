# SP: pSeleccionarCompuestoGen
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtCompuesto`](../tables/saArtCompuesto.md)
- [`saArtCompuestoGen`](../tables/saArtCompuestoGen.md)
- [`saArticulo`](../tables/saArticulo.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarCompuestoGen
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarCompuestoGen] ( @sGene_Num CHAR(20) )
AS 
    BEGIN
		
        SELECT
            c.co_uni, g.*, '0' as tipo_trans,  a.art_des, a.maneja_lote, a.maneja_serial
        FROM
            saArtCompuestoGen AS g
            INNER JOIN saArticulo a ON g.co_art = a.co_art
            LEFT JOIN saArtCompuesto AS c ON c.co_art = g.co_art
        WHERE
            g.gene_num = @sGene_Num

    END
```
