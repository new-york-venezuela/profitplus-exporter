# SP: pSeleccionarTipoDocumentoSinFiltro
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pSeleccionarTipoDocumentoSinFiltro]
DESCRIPCION: Selecciona todos los registros de la tabla saTipoDocumento
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarTipoDocumentoSinFiltro]
AS 
    BEGIN
        SELECT
            *
        FROM
            saTipoDocumento
    END
```
