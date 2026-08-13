# SP: pSeleccionarCompuesto
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtCompuesto`](../tables/saArtCompuesto.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarCompuesto
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarCompuesto] ( @sCo_ArtC CHAR(20) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saArtCompuesto
        WHERE
            co_artc = @sCo_ArtC
    END
```
