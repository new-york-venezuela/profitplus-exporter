# SP: pObtenerDisponiblidadCaja
**Tipo**: Obtener
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saSaldoCaja`](../tables/saSaldoCaja.md)

## Código (excerpt)
```sql
/**********************************************************************************************
*NOMBRE			:	pObtenerDisponiblidadCaja
*DESCRIPCION	:	Obtiene los saldo actuales de una Caja
*AUTOR			:	SOFTECH SISTEMAS
*FECHA			:	15/12/2009
**********************************************************************************************/
CREATE PROCEDURE [pObtenerDisponiblidadCaja] ( @sCod_Caja CHAR(6) )
AS 
    BEGIN

        DECLARE @deSaldoTotalActual DECIMAL(18, 2)
        DECLARE @deSaldoEfectActual DECIMAL(18, 2)	


        SET @deSaldoTotalActual = ( SELECT
                                        saldo
                                    FROM
                                        saSaldoCaja
                                    WHERE
                                        cod_caja = @sCod_Caja
                                        AND tipo = 'TF'
                                  )

        SET @deSaldoEfectActual = ( SELECT
                                        saldo
                                    FROM
                                        saSaldoCaja
                                    WHERE
                                        cod_caja = @sCod_Caja
                                        AND tipo = 'EF'
                                  )

        SELECT
            @deSaldoTotalActual AS SaldoTotalCaja, @deSaldoEfectActual AS SaldoEfectCaja 

    END
```
