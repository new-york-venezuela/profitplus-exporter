# SP: pObtenerDisponiblidadBancaria
**Tipo**: Obtener
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)
- [`saCheque`](../tables/saCheque.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saDepositoBanco`](../tables/saDepositoBanco.md)
- [`saDepositoBancoReng`](../tables/saDepositoBancoReng.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)
- [`saSaldoBanco`](../tables/saSaldoBanco.md)

## Código (excerpt)
```sql
/**********************************************************************************************
*NOMBRE			:	pObtenerDisponiblidadBancaria
*DESCRIPCION	:	Obtiene los datos correxpondientes a la solicitud de un estado de saldos en cuenta bancaria
*AUTOR			:	SOFTECH SISTEMAS.
*FECHA			:	11/11/2009
**********************************************************************************************/
CREATE PROCEDURE [pObtenerDisponiblidadBancaria] ( @sCodCta CHAR(6) )
AS 
    BEGIN

        DECLARE @deDepositoDiferido DECIMAL(18, 2)
        DECLARE @deChequeEmitido DECIMAL(18, 2)
        DECLARE @deSaldoActual DECIMAL(18, 2)
        DECLARE @deChequeSinEntregar DECIMAL(18, 2)

        SET @deDepositoDiferido = ( SELECT
                                        ISNULL(SUM(dbr.monto), 0) DepositoDiferido
                                    FROM
                                        saDepositoBancoReng dbr
                                        INNER JOIN saDepositoBanco db ON dbr.dep_num = db.dep_num
                                        LEFT JOIN saMovimientoCaja mc ON dbr.mov_gene_c = mc.mov_num
                                        INNER JOIN saCuentaBancaria cb ON db.cod_cta = cb.cod_cta
                                        INNER JOIN saBanco bn ON cb.co_ban = bn.co_ban
                                    WHERE
                                        ( mc.forma_pag = 'CH'
                                          AND db.cod_cta = @sCodCta
                                          AND DATEDIFF(dd, GETDATE(),
                                                       ( CASE dbr.tipo_plazo
                                                           WHEN '1' THEN DATEADD(day, bn.plazo1, db.fecha)
                                                           WHEN '2' THEN DATEADD(day, bn.plazo2, db.fecha)
                                                           WHEN '3' THEN DATEADD(day, bn.plazo3, db.fecha)
                                                           WHEN '4' THEN DATEADD(day, bn.plazo4, db.fecha)
                                                           ELSE db.fecha
                                                         END )) >= 0
                                        )
                                  )

        SET @deChequeEmitido = ( SELECT
                                    ISNULL(SUM(mb.monto_h + mb.monto_d), 0) AS ChequeEmitido
                                 FROM
```
