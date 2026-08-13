# SP: pSeleccionarBanco
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarBanco
DESCRIPCION: Seleccion de un registro de la tabla bancos
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarBanco] ( @sCo_Ban CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saBanco
        WHERE
            co_ban = @sCo_Ban
    END
```
