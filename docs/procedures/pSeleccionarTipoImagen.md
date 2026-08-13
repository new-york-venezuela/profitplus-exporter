# SP: pSeleccionarTipoImagen
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saTipoImagen`](../tables/saTipoImagen.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarTipoImagen
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarTipoImagen] ( @sCo_Tipo_Imag CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saTipoImagen
        WHERE
            co_tipo_imag = @sCo_Tipo_Imag
    END
```
