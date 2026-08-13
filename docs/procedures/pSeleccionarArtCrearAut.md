# SP: pSeleccionarArtCrearAut
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saArtCrearAut`](../tables/saArtCrearAut.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarArtCrearAut
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/ 
Create PROCEDURE [dbo].[pSeleccionarArtCrearAut] ( @sCo_artCrearAut CHAR(30) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saArtCrearAut
        WHERE
            co_artCrearAut = @sCo_artCrearAut
    END
```
