# SP: pSeleccionarSegmento
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saSegmento`](../tables/saSegmento.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarSegmento
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarSegmento] ( @sCo_Seg CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saSegmento
        WHERE
            co_seg = @sCo_Seg
    END
```
