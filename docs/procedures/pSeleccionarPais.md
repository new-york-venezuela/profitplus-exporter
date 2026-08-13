# SP: pSeleccionarPais
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saPais`](../tables/saPais.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarPais
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarPais] ( @sCo_Pais CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saPais
        WHERE
            co_pais = @sCo_Pais
    END
```
