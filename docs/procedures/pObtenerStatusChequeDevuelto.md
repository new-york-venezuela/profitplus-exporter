# SP: pObtenerStatusChequeDevuelto
**Tipo**: Obtener
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saPagoTPReng`](../tables/saPagoTPReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:pObtenerStatusChequeDevuelto
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerStatusChequeDevuelto] ( @sCodPago CHAR(20) )
AS 
    BEGIN
        DECLARE @bDevuelto BIT
        SET @bDevuelto = ( SELECT
                            devuelto
                           FROM
                            sapagoTPReng
                           WHERE
                            cob_num = @sCodPago
                         )

        SELECT
            @bDevuelto

    END
```
