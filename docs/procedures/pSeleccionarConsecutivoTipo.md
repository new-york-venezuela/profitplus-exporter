# SP: pSeleccionarConsecutivoTipo
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saConsecutivoTipo`](../tables/saConsecutivoTipo.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			[pSeleccionarConsecutivoTipo]
DESCRIPCION:	Consulta a la tabla saConsecutivoTipo
CREADO POR:		SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarConsecutivoTipo]
AS 
    BEGIN
        SELECT
            *
        FROM
            saConsecutivoTipo
    END
```
