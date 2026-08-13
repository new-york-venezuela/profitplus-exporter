# SP: pSeleccionarCaja
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCaja`](../tables/saCaja.md)
- [`saSaldoCaja`](../tables/saSaldoCaja.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarCaja
DESCRIPCION: Seleccionar Caja
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarCaja] ( @sCod_Caja CHAR(6) )
AS 
    BEGIN
        SELECT
            ISNULL(( SELECT
                        saldo
                     FROM
                        saSaldoCaja
                     WHERE
                        tipo = 'EF'
                        AND cod_caja = cj.cod_caja
                   ), 0) saldo_e, ISNULL(( SELECT
                                            saldo
                                           FROM
                                            saSaldoCaja
                                           WHERE
                                            tipo = 'TF'
                                            AND cod_caja = cj.cod_caja
                                         ), 0) saldo_a, ISNULL(( SELECT
                                                                    saldo
                                                                 FROM
                                                                    saSaldoCaja
                                                                 WHERE
                                                                    tipo = 'TI'
                                                                    AND cod_caja = cj.cod_caja
                                                               ), 0) saldo_i, ISNULL(( SELECT
                                                                                        saldo
                                                                                       FROM
                                                                                        saSaldoCaja
                                                                                       WHERE
                                                                                        tipo = 'EI'
                                                                                        AND cod_caja = cj.cod_caja
                                                                                     ), 0) saldo_ei, cj.*
        FROM
            saCaja cj
        WHERE
            cj.cod_caja = @sCod_Caja
    END
```
