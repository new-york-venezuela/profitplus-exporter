# SP: pSeleccionarStatusConciliado
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarStatusConciliado
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarStatusConciliado] ( @sMov_num CHAR(20) )
AS 
    BEGIN
        SELECT
            conciliado
        FROM
            saMovimientoBanco
        WHERE
            mov_num = @sMov_num
    END
```
