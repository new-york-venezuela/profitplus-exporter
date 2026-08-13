# SP: RepDisponibilidadBancaria
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saMoneda`](../tables/saMoneda.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <20/08/2010>
-- Description:	<Disponibilidad en Cuentas Bancarias>
-- =============================================
CREATE PROCEDURE [RepDisponibilidadBancaria]
    @sCo_CodCuenta_d CHAR(6) = NULL ,
    @sCo_CodCuenta_h CHAR(6) = NULL ,
    @sCo_CuentaIngr_d CHAR(20) = NULL ,
    @sCo_CuentaIngr_h CHAR(20) = NULL ,
    @sCo_Descripcion_d CHAR(60) = NULL ,
    @sCo_Descripcion_h CHAR(60) = NULL ,
    @dFecha SMALLDATETIME = NULL ,
    @Co_Moneda CHAR(6) = NULL ,
    @cCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON;
	
        SELECT
            num_cta, inactivo, co_mone, mone_des, relacion, co_ban, des_ban, cod_cta, tasa_fec,
            ROUND(( CASE WHEN relacion = 0 THEN saldo / ( CASE WHEN @Co_Moneda IS NULL THEN 1
                                                               ELSE tasa_fec
                                                          END )
                         ELSE saldo * ( CASE WHEN @Co_Moneda IS NULL THEN 1
                                             ELSE tasa_fec
                                        END )
                    END ), 2) AS saldo, monto_Dif, cheq_emi, saldo_ini,
A.Campo1,
A.Campo2,
A.Campo3,
A.Campo4,
A.Campo5,
A.Campo6,
A.Campo7,
A.Campo8


        FROM
            ( SELECT
                CU.num_cta, CU.inactivo, CU.co_mone, MO.mone_des, MO.relacion, BA.co_ban, BA.des_ban, CU.cod_cta,
                CASE WHEN @Co_Moneda IS NULL THEN ISNULL(dbo.TasaAUnaFecha(CU.co_mone, 0.00000, @dFecha), 0.00000)
                     ELSE 1.00000
                END AS tasa_fec,
                ROUND(ISNULL(dbo.SaldoBancoAUnaFechaxCtaIngrEgrxSucursal(CU.cod_cta, @dFecha, @sCo_CuentaIngr_d,
                                                                         @sCo_CuentaIngr_h, @cCo_Sucursal, 2), 0)
                      * CASE WHEN @Co_Moneda IS NULL THEN ISNULL(dbo.TasaAUnaFecha(CU.co_mone, 0, @dFecha), 0.00000)
                             ELSE 1.00000
                        END, 2) AS saldo,
                ROUND(ISNULL(dbo.[ObtenerMontoDiferidoxCtaIngrEgrxSucursal](CU.cod_cta, @dFecha, @sCo_CuentaIngr_d,
                                                                            @sCo_CuentaIngr_h, @cCo_Sucursal), 0.00)
                      * CASE WHEN @Co_Moneda IS
```
