# SP: pObtenerStatusSaldoInicial
**Tipo**: Obtener
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:pObtenerStatusSaldoInicial
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerStatusSaldoInicial] ( @sCodCta CHAR(20) )
AS 
    BEGIN
        DECLARE @bInicial BIT
        SET @bInicial = ( SELECT
                            saldo_ini
                          FROM
                            samovimientoBanco
                          WHERE
                            cod_cta = @sCodCta
                        )

        SELECT
            @bInicial

    END
```
