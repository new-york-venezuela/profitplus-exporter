# SP: pValidarSaldoBancoInactivo
**Tipo**: Validar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saSaldoBanco`](../tables/saSaldoBanco.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			pValidarSaldoBancoInactivo
CREADO:			<2011-12-12>
MODIFICADO:		<2020-07-01>
DESCRIPCION:	Procedimiento que valida la consistencia del saldo en Banco
CREADO POR:		SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pValidarSaldoBancoInactivo]
    @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
    @IdProcess UNIQUEIDENTIFIER
AS 
    BEGIN

        DECLARE @ValStockResult TABLE ( Motivo VARCHAR(256) )

        DECLARE SALDO_VALIDAR CURSOR LOCAL FAST_FORWARD
        FOR
            SELECT
                A.cod_cta, ISNULL(B.saldo, 0) AS Saldo
            FROM
                saCuentaBancaria A
                LEFT JOIN saSaldoBanco B ON A.cod_cta = B.cod_cta
                                            AND B.tipo = 'TF'
            WHERE
                ISNULL(B.saldo, 0) <> 0
                AND a.inactivo = 1
            ORDER BY
                cod_cta, tipo

        OPEN SALDO_VALIDAR

        DECLARE @pCod_Cta CHAR(6)
        DECLARE @pSaldo DECIMAL(18, 2)

        FETCH NEXT FROM SALDO_VALIDAR INTO @pCod_Cta, @pSaldo

        WHILE @@FETCH_STATUS = 0 
            BEGIN

                INSERT  INTO @ValStockResult
                        ( Motivo )
                VALUES
                        ( 'El saldo de la cuenta bancaria "' + RTRIM(@pCod_Cta) + '" es ' + CONVERT(VARCHAR, @pSaldo)
                          + ' y la cuenta se encuentra inactiva. *NC' )

                FETCH NEXT FROM SALDO_VALIDAR INTO @pCod_Cta, @pSaldo
            END 

        CLOSE SALDO_VALIDAR

        DEALLOCATE SALDO_VALIDAR

        SELECT
            *
        FROM
            @ValStockResult

    END
```
