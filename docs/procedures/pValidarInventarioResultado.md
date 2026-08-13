# SP: pValidarInventarioResultado
**Tipo**: Validar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saResInventario`](../tables/saResInventario.md)

## Código (excerpt)
```sql
/*************************************************************************************************
*NOMBRE			: [pValidarInventarioResultado]
*DESCRIPCIÓN	: verifica si existe o no resultado de inventarios
*AUTOR			: SOFTECH SISTEMAS
*FECHA			: 2010-05-25
*************************************************************************************************/

CREATE PROCEDURE [pValidarInventarioResultado]
    (
      @sCo_InvFisico CHAR(20)
    )
AS 
    BEGIN	

        SELECT
            co_invfisico
        FROM
            saResInventario
        WHERE
            co_invfisico = @sCo_InvFisico

    END
```
