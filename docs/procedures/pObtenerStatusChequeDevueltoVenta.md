# SP: pObtenerStatusChequeDevueltoVenta
**Tipo**: Obtener
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCobroTPReng`](../tables/saCobroTPReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:pObtenerStatusChequeDevueltoVenta
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerStatusChequeDevueltoVenta] ( @sCodCobro CHAR(20) )
AS 
    BEGIN
        DECLARE @bDevuelto BIT
        SET @bDevuelto = ( SELECT
                            devuelto
                           FROM
                            saCobroTPReng
                           WHERE
                            cob_num = @sCodCobro
                         )

        SELECT
            @bDevuelto

    END
```
