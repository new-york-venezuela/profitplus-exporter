# SP: pValidarSaldoCajaInactiva
**Tipo**: Validar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCaja`](../tables/saCaja.md)
- [`saSaldoCaja`](../tables/saSaldoCaja.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			pValidarSaldoCajaInactiva
CREADO:			<2011-12-12>
MODIFICADO:		<2020-07-01>
DESCRIPCION:	Procedimiento que valida la consistencia del saldo en la caja inactiva
CREADO POR:		SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pValidarSaldoCajaInactiva]
    @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
    @IdProcess UNIQUEIDENTIFIER
AS 
    BEGIN

        DECLARE @ValStockResult TABLE ( Motivo VARCHAR(256) )

        DECLARE SALDO_VALIDAR CURSOR LOCAL FAST_FORWARD
        FOR
            SELECT
                A.cod_caja, ISNULL(B.saldo, 0) AS Saldo
            FROM
                saCaja A
                LEFT JOIN saSaldoCaja B ON A.cod_caja = B.cod_caja
                                           AND B.tipo = 'TF'
            WHERE
                A.inactivo = 1
                AND ISNULL(B.saldo, 0) <> 0
            ORDER BY
                cod_caja

        OPEN SALDO_VALIDAR

        DECLARE @pCod_Caja CHAR(6)
        DECLARE @pSaldo DECIMAL(18, 2)

        FETCH NEXT FROM SALDO_VALIDAR INTO @pCod_Caja, @pSaldo

        WHILE @@FETCH_STATUS = 0 
            BEGIN
                INSERT  INTO @ValStockResult
                        ( Motivo )
                VALUES
                        ( 'El saldo de la caja "' + RTRIM(@pCod_Caja) + '" es ' + CONVERT(VARCHAR, @pSaldo)
                          + ' y la caja se encuentra inactiva. *NC' )
	
                FETCH NEXT FROM SALDO_VALIDAR INTO @pCod_Caja, @pSaldo
            END 

        CLOSE SALDO_VALIDAR

        DEALLOCATE SALDO_VALIDAR

        SELECT
            *
        FROM
            @ValStockResult

    END
```
