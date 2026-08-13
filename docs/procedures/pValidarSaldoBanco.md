# SP: pValidarSaldoBanco
**Tipo**: Validar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)
- [`saSaldoBanco`](../tables/saSaldoBanco.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			pValidarSaldoBanco
CREADO:			<2011-12-12>
MODIFICADO:		<2020-07-01>
DESCRIPCION:	Procedimiento que valida la consistencia del saldo en Banco
CREADO POR:		SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pValidarSaldoBanco]
    @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
    @IdProcess UNIQUEIDENTIFIER
AS 
    BEGIN

        DECLARE @ValStockResult TABLE ( Motivo VARCHAR(256) )

        DECLARE SALDO_VALIDAR CURSOR LOCAL FAST_FORWARD
        FOR
            SELECT
                A.cod_cta, CASE WHEN B.cod_cta IS NULL THEN 1
                                ELSE 0
                           END AS Insertar, 'TI' AS Tipo, ISNULL(B.saldo, 0) AS Saldo, ISNULL(C.monto, 0) AS SaldoReal
            FROM
                saCuentaBancaria A
                LEFT JOIN saSaldoBanco B ON A.cod_cta = B.cod_cta
                                            AND B.tipo = 'TI'
                LEFT JOIN ( 
							SELECT
                                SUM(C.monto_h - C.monto_d - (C.idb * Case when C.monto_h > 0 then -1 else 1 end)) AS monto, C.cod_cta
                            FROM
                                saMovimientoBanco C
                            WHERE
                                C.Saldo_Ini = 1
                                AND C.anulado = 0
                            GROUP BY
                                C.cod_cta
                          ) AS C ON C.cod_cta = A.cod_cta
            WHERE
                ISNULL(B.saldo, 0) <> ISNULL(C.monto, 0)
            UNION
            SELECT
                A.cod_cta, CASE WHEN B.cod_cta IS NULL THEN 1
                                ELSE 0
                           END AS Insertar, 'CI' AS Tipo, ISNULL(B.saldo, 0) AS Saldo, ISNULL(C.monto, 0) AS SaldoReal
            FROM
                saCuentaBancaria A
                LEFT JOIN saSaldoBanco B ON A.cod_cta = B.cod_cta
                                            AND B.tipo = 'CI'
                LEFT JOIN ( SELECT
                                SUM(C.monto_h - C.monto_d - (C.idb * Case when C.monto_h > 0 then -1 else 1 end)) AS monto, C.cod_cta
                            FROM
                                saMovimientoBanco C
                            WHERE
```
