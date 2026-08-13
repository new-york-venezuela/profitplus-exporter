# SP: pSeleccionarComisionTipo
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saComisionTipo`](../tables/saComisionTipo.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarComisionTipo
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarComisionTipo] ( @sCo_Comi CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saComisionTipo
        WHERE
            co_comi = @sCo_Comi
    END
```
