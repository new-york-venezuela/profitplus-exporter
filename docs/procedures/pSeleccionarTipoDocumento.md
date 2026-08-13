# SP: pSeleccionarTipoDocumento
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarTipoDocumento
DESCRIPCION: Selecciona de saTipoDocumento
CREADO POR:  SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarTipoDocumento] ( @sCo_Tipo_Doc CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saTipoDocumento
        WHERE
            co_tipo_doc = @sCo_Tipo_Doc
    END
```
