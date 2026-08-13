# SP: pSeleccionarArtCaracteristicaRenglon
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtCaracteristica`](../tables/saArtCaracteristica.md)
- [`saLineaArticulo`](../tables/saLineaArticulo.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarUnidadArticuloRenglon
DESCRIPCION: Seleccionar las Unidad por Articulo
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/ 
CREATE PROCEDURE [dbo].[pSeleccionarArtCaracteristicaRenglon] ( @sCo_Art CHAR(30) )
AS 
    BEGIN 

        SELECT
            Au.*, u.lin_des AS Des_Lin
        FROM
            saArtCaracteristica AS Au
            INNER JOIN saLineaArticulo u ON Au.co_lin01 = u.co_lin
        WHERE
            co_art = @sCo_Art
        --ORDER BY
        --    co_art DESC, uni_principal DESC, uso_principal DESC, uni_secundaria DESC, uso_secundaria DESC

    END
```
