# SP: pSeleccionarUnidadArticuloRenglon
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saUnidad`](../tables/saUnidad.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarUnidadArticuloRenglon
DESCRIPCION: Seleccionar las Unidad por Articulo
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarUnidadArticuloRenglon] ( @sCo_Art CHAR(30) )
AS 
    BEGIN 

        SELECT
            Au.*, u.des_uni AS Des_Uni
        FROM
            saArtUnidad AS Au
            INNER JOIN saUnidad u ON Au.co_uni = u.co_uni
        WHERE
            co_art = @sCo_Art
        ORDER BY
            co_art DESC, uni_principal DESC, uso_principal DESC, uni_secundaria DESC, uso_secundaria DESC

    END
```
