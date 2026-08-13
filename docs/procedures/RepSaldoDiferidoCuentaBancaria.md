# SP: RepSaldoDiferidoCuentaBancaria
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <20/08/2010>
-- Description:	<Saldos Diferidos en Cuentas Bancarias>
-- =============================================
CREATE PROCEDURE [RepSaldoDiferidoCuentaBancaria]
	-- Add the parameters for the stored procedure here
    @cCo_CodCuenta_d CHAR(6) = NULL ,
    @cCo_CodCuenta_h CHAR(6) = NULL ,
    @cCo_CuentaIngr_d CHAR(20) = NULL ,
    @cCo_CuentaIngr_h CHAR(20) = NULL ,
    @sCo_Descripcion_d CHAR(60) = NULL ,
    @sCo_Descripcion_h CHAR(60) = NULL ,
    @sFecha SMALLDATETIME = NULL ,
    @Co_Moneda CHAR(6) = NULL ,
    @cCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

	
        SELECT
            CU.num_cta, CU.inactivo, CU.co_mone, MO.mone_des, BA.co_ban, BA.des_ban, MB.cod_cta,
            SUM(MB.monto_h) AS monto_h, SUM(MB.monto_d) AS monto_d, SUM(MB.idb) AS idb,
            ISNULL(dbo.SaldoBancoAUnaFecha(CU.cod_cta, @sFecha - 1, 2), 0) AS saldo_ini1,
            ISNULL(dbo.TasaAUnaFecha(CU.co_mone, 0, @sFecha - 1), 0) AS tasa_fec,
            ISNULL(dbo.ObtenerMontoDiferido(CU.cod_cta), 0) AS Monto_Dif
        FROM
            saMovimientoBanco AS MB
            INNER JOIN saCuentaBancaria AS CU ON CU.cod_cta = MB.cod_cta
            INNER JOIN saMoneda AS MO ON MO.co_mone = CU.co_mone
            INNER JOIN saBanco AS BA ON BA.co_ban = CU.co_ban
        WHERE
            ( ( @cCo_CodCuenta_d IS NULL
                OR MB.cod_cta >= @cCo_CodCuenta_d
              )
              AND ( @cCo_CodCuenta_h IS NULL
                    OR MB.cod_cta <= @cCo_CodCuenta_h
                  )
            )
            AND ( ( @cCo_CuentaIngr_d IS NULL
                    OR MB.co_cta_ingr_egr >= @cCo_CuentaIngr_d
                  )
                  AND ( @cCo_CuentaIngr_h IS NULL
                        OR MB.co_cta_ingr_egr <= @cCo_CuentaIngr_h
                      )
                )
            AND ( ( @sCo_Descripcion_d IS NULL
                    OR BA.des_ban >= @sCo_Descripcion_d
                  )
                  AND ( @sCo_Descripcion_h IS NULL
                        OR BA.des_ban <= @sCo_Descripcion_h
                      )
                )
            AND ( @sFecha IS NULL
                  OR DATEADD(day, 0, MB.fecha) >= @sFecha
                )
            AND ( @Co_Moneda
```
