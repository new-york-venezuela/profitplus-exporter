# SP: pValidarInventarioFisicoPorFecha
**Tipo**: Validar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saInventarioFisico`](../tables/saInventarioFisico.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pValidarInventarioFisicoPorFecha]
    (
      @sdFechaEmision SMALLDATETIME ,
      @sCodigoAlmacen CHAR(6)
    )
AS 
    BEGIN

        SELECT
            COUNT(invf.co_invfisico) AS existe
        FROM
            saInventarioFisico invf
        WHERE
            invf.inicio > @sdFechaEmision
            AND invf.co_alma = @scodigoAlmacen
            AND procesado = 0

    END
```
