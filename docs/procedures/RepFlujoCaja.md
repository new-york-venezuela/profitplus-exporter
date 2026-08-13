# SP: RepFlujoCaja
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)
- [`saCobro`](../tables/saCobro.md)
- [`saCobroTPReng`](../tables/saCobroTPReng.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)
- [`saOrdenPago`](../tables/saOrdenPago.md)
- [`saOrdenPagoReng`](../tables/saOrdenPagoReng.md)
- [`saPago`](../tables/saPago.md)
- [`saPagoTPReng`](../tables/saPagoTPReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: RepFlujoCaja
DESCRIPCION: Reporte de Flujo de Caja
CREADO POR: SOFTECH SISTEMAS
CREATE DATE: 2012-04-25 
LAST DATE:2017-06-27
***************************************************************************************************************/ 
CREATE PROCEDURE [dbo].[RepFlujoCaja]
    (
      @dFecha_d SMALLDATETIME = null,
	  @dFecha_h SMALLDATETIME =  null,
      @IIngreso decimal(18,2)= 000000000000.00 ,
      @IEngreso decimal(18,2)= 000000000000.00 ,
	  @bHeaderRep BIT = 0
    )
AS 
    BEGIN

	SET NOCOUNT ON;

        SELECT
            @IIngreso AS Ingreso, @IEngreso AS Egreso, monto_cobros, orden, monto_pagos, saldo, idb, monto_financieros,Total_Egresos_Financieros
        FROM
            ( SELECT
                ISNULL(SUM(PR.mont_doc),0.00) AS monto_cobros
              FROM
                saCobroTPReng PR
                INNER JOIN saCobro AS PA ON PA.cob_num = PR.cob_num
                                            AND forma_pag <> 'CH'
              WHERE
				 ( ( @dFecha_d IS NULL
                    OR fecha >= @dFecha_d
                  )
                  AND ( @dFecha_h IS NULL
                       OR fecha <= @dFecha_h
                      )
				  )
            ) AS cobros ,
		(SELECT ISNULL(  case when sum(monto_d)- sum(monto_h) <1 
                       THEN ( (sum(monto_d)- sum(monto_h)) * -1)
                   else sum(monto_d- monto_h)
                  end,0.00)  as monto_financieros
			--sum(monto_d - monto_h)
			FROM dbo.saMovimientoBanco 
			WHERE tipo_op IN ('IN', 'NC', 'RD', 'DP','TP')
			AND Origen <> 'COB'
				
			 /*('IN','DP','RD','DP','TP')*/
				and  ( ( @dFecha_d IS NULL
                    OR fecha >= @dFecha_d
                  )
                  AND ( @dFecha_h IS NULL
                        OR fecha <= @dFecha_h
                      )
				  )
			) as monto_financieros,
			(
			SELECT ISNULL(  case when sum(monto_d)- sum(monto_h) <1 
                       THEN ( (sum(monto_d)- sum(monto_h)) * -1)
                   else sum(monto_d- monto_h)
                  end,0.00)  as Total_Egresos_Financieros 
			--sum(monto_d - monto_h)
			FROM dbo.saMovimientoBanco 
			WHERE tipo_op IN ('TR', 'CH', 'ND', 'RC')
			--AND Origen <> 'COB'
			AND Origen = 'BAN'
			and  ( ( @dFecha_d IS NULL
                    OR fecha >= @dFecha_d
```
