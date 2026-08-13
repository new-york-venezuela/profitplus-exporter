# SP: pSeleccionarCuentaBancaria
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saSaldoBanco`](../tables/saSaldoBanco.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarCuentaBancaria
DESCRIPCION: Seleccionar Cuenta Bancaria
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarCuentaBancaria] ( @sCod_Cta CHAR(6) )
AS 
    BEGIN
        SELECT
            cb.*, ISNULL(( SELECT
                            saldo
                           FROM
                            saSaldoBanco
                           WHERE
                            tipo = 'TI'
                            AND cod_cta = @sCod_Cta
                         ), 0) Saldo_TI, ISNULL(( SELECT
                                                    saldo
                                                  FROM
                                                    saSaldoBanco
                                                  WHERE
                                                    tipo = 'CI'
                                                    AND cod_cta = @sCod_Cta
                                                ), 0) Saldo_CI, ISNULL(( SELECT
                                                                            saldo
                                                                         FROM
                                                                            saSaldoBanco
                                                                         WHERE
                                                                            tipo = 'TF'
                                                                            AND cod_cta = @sCod_Cta
                                                                       ), 0) Saldo_TF,
            ISNULL(( SELECT
                        saldo
                     FROM
                        saSaldoBanco
                     WHERE
                        tipo = 'CF'
                        AND cod_cta = @sCod_Cta
                   ), 0) Saldo_CF
        FROM
            saCuentaBancaria cb
        WHERE
            cb.cod_cta = @sCod_Cta
    END
```
