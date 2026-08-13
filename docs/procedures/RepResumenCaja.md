# SP: RepResumenCaja
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCaja`](../tables/saCaja.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <23/08/2010>
-- Description:	<Resumen de Cajas>
-- =============================================
CREATE PROCEDURE [dbo].[RepResumenCaja]
	-- Add the parameters for the stored procedure here
    @sCo_CodCaja_d CHAR(6) = NULL ,
    @sCo_CodCaja_h CHAR(6) = NULL ,
    @sCo_CuentaIngr_d CHAR(20) = NULL ,
    @sCo_CuentaIngr_h CHAR(20) = NULL ,
    @dFecha_d DATETIME = NULL ,
    @dFecha_h DATETIME = NULL ,
    @sCo_Moneda CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;


        SELECT
            CA.cod_caja, 
			CA.descrip, 
			CA.inactivo, 
			CA.co_mone, 
			MO.mone_des, 
			MC.tipo_mov,
			MC.forma_pag,
			MC.monto_d,
			MC.monto_h,
			MC.origen,
			MC.campo1,
			MC.campo2,
			MC.campo3,
			MC.campo4,
			MC.campo5,
			MC.campo6,
			MC.campo7,
			MC.campo8,
            ISNULL(dbo.SaldoCajaAUnaFecha(CA.cod_caja, @dFecha_d - 1), 0) AS saldo_ini,
            ISNULL(dbo.TasaAUnaFecha(CA.co_mone, 0, @dFecha_d - 1), 0) AS tasa_fec, 
			@dFecha_h AS Fecha_Hasta
        FROM
            saMovimientoCaja AS MC
            INNER JOIN saCaja AS CA ON CA.cod_caja = MC.cod_caja
            INNER JOIN saMoneda AS MO ON MO.co_mone = CA.co_mone
        WHERE
            ( ( @sCo_CodCaja_d IS NULL
                OR MC.cod_caja >= @sCo_CodCaja_d
              )
              AND ( @sCo_CodCaja_h IS NULL
                    OR MC.cod_caja <= @sCo_CodCaja_h
                  )
            )
            AND ( ( @sCo_CodCaja_d IS NULL
                    OR MC.co_cta_ingr_egr >= @sCo_CodCaja_d
                  )
                  AND ( @sCo_CuentaIngr_h IS NULL
                        OR MC.co_cta_ingr_egr <= @sCo_CuentaIngr_h
                      )
                )
            AND ( ( @dFecha_d IS NULL
                    OR dbo.fechasimple(MC.fecha) >= @dFecha_d
                  )
                  AND ( @dFecha_h IS NULL
                        OR dbo.fechasimple(MC.fecha) <= @dFecha_h
                      )
                )
            AND ( @sCo_Moneda IS NULL
                  OR @sCo_Moneda = MO.co_mone
                )
            AND ( @sCo_Sucursal IS NULL
                  OR @sCo_Sucursal = MC.co_sucu_in
                )
            AND ( MC.anulado = 0 )
```
