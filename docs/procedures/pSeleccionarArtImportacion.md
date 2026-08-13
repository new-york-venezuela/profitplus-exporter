# SP: pSeleccionarArtImportacion
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saArtImportacion`](../tables/saArtImportacion.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarArtImportacion
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarArtImportacion] ( @sCo_Art CHAR(30) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saArtImportacion
        WHERE
            co_art = @sCo_Art
    END
```
