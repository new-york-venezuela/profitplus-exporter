# SP: pSeleccionarTabuladorIslrRenglon
**Tipo**: Seleccionar
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saConISLR`](../tables/saConISLR.md)
- [`saTabuladorIslrReng`](../tables/saTabuladorIslrReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarTabuladorIslrRenglon
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarTabuladorIslrRenglon] ( @sCo_Tab CHAR(20) )
AS 
    BEGIN 

        SELECT
            t.*, c.islr_des
        FROM
            saTabuladorIslrReng AS t
            INNER JOIN saConISLR c ON t.co_islr = c.co_islr
        WHERE
            co_tab = @sCo_Tab
        ORDER BY
            reng_num ASC
    END
```
