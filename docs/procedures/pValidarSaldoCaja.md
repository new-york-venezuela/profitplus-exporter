# SP: pValidarSaldoCaja
**Tipo**: Validar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCaja`](../tables/saCaja.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)
- [`saSaldoCaja`](../tables/saSaldoCaja.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			pValidarSaldoCaja
CREADO:			<2011-12-12>
MODIFICADO:		<2020-07-01>
DESCRIPCION:	Procedimiento que valida la consistencia del saldo en la caja
CREADO POR:		SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pValidarSaldoCaja]
    @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
    @IdProcess UNIQUEIDENTIFIER
AS 
    BEGIN

        DECLARE @ValStockResult TABLE ( Motivo VARCHAR(256) )

        DECLARE SALDO_VALIDAR CURSOR LOCAL FAST_FORWARD
        FOR
            SELECT
                A.cod_caja, CASE WHEN B.cod_caja IS NULL THEN 1
                                 ELSE 0
                            END AS Insertar, 'TI' AS Tipo, ISNULL(B.saldo, 0) AS Saldo, ISNULL(C.monto, 0) AS SaldoReal
            FROM
                saCaja A
                LEFT JOIN saSaldoCaja B ON A.cod_caja = B.cod_caja
                                           AND B.tipo = 'TI'
                LEFT JOIN ( SELECT
                                SUM(C.monto_h - C.monto_d) AS monto, C.cod_caja
                            FROM
                                saMovimientoCaja C
                            WHERE
                                C.Saldo_Ini = 1
                                AND C.anulado = 0
                            GROUP BY
                                C.cod_caja
                          ) AS C ON C.cod_caja = A.cod_caja
            WHERE
                ISNULL(B.saldo, 0) <> ISNULL(C.monto, 0)
            UNION
            SELECT
                A.cod_caja, CASE WHEN B.cod_caja IS NULL THEN 1
                                 ELSE 0
                            END AS Insertar, 'EI' AS Tipo, ISNULL(B.saldo, 0) AS Saldo, ISNULL(C.monto, 0) AS SaldoReal
            FROM
                saCaja A
                LEFT JOIN saSaldoCaja B ON A.cod_caja = B.cod_caja
                                           AND B.tipo = 'EI'
                LEFT JOIN ( SELECT
                                SUM(C.monto_h - C.monto_d) AS monto, C.cod_caja
                            FROM
                                saMovimientoCaja C
                            WHERE
                                C.Saldo_Ini = 1
                                AND C.forma_pag = 'EF'
```
