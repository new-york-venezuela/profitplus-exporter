# SP: pSeleccionarOrdenPagoFiltrada
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saOrdenPago`](../tables/saOrdenPago.md)
- [`saOrdenPagoReng`](../tables/saOrdenPagoReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarOrdenPago
DESCRIPCION: Selecciona todos los campos de Orden de Pago Filtrada
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarOrdenPagoFiltrada] ( @sBeneficiario CHAR(10) )
AS 
    BEGIN
        IF @sBeneficiario = ''
            OR @sBeneficiario = NULL 
            BEGIN	
                SELECT
                    op.*, ISNULL(op.cod_cta, op.cod_caja) AS Cta, ( SELECT
                                                                        ISNULL(SUM(pr.monto_d - pr.monto_h), 0)
                                                                    FROM
                                                                        saOrdenPagoReng pr
                                                                    WHERE
                                                                        pr.ord_num = op.ord_num
                                                                  ) AS sumaMonto
                FROM
                    saOrdenPago op
                WHERE
                    op.anulado = 0
                    AND op.status <> 'C'
            END
        ELSE 
            BEGIN
                SELECT
                    op.*, ( SELECT
                                ISNULL(SUM(pr.monto_d - pr.monto_h), 0)
                            FROM
                                saOrdenPagoReng pr
                            WHERE
                                pr.ord_num = op.ord_num
                          ) AS sumaMonto
                FROM
                    saOrdenPago op
                WHERE
                    op.cod_ben = @sBeneficiario
                    AND op.anulado = 0
                    AND op.status <> 'C'
            END
    END
```
