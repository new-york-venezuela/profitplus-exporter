# SP: RepSaldoCaja
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
-- Create date: <20/08/2010>
-- Description:	<Saldo en Caja>
-- =============================================
CREATE PROCEDURE [dbo].[RepSaldoCaja]
	-- Add the parameters for the stored procedure here
    @cCo_CodCaja_d CHAR(6) = NULL ,
    @cCo_CodCaja_h CHAR(6) = NULL ,
    @cCo_CuentaIngr_d CHAR(20) = NULL ,
    @cCo_CuentaIngr_h CHAR(20) = NULL ,
    @sCo_Descripcion_d CHAR(60) = NULL ,
    @sCo_Descripcion_h CHAR(60) = NULL ,
    @dFecha_d SMALLDATETIME = NULL ,
    @dFecha_h SMALLDATETIME = NULL ,
    @Co_Moneda CHAR(6) = NULL ,
    @cCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
	
        IF @dFecha_h IS NOT NULL 
            SET @dFecha_h = dbo.FechaSimple(@dFecha_h)

        SELECT
            monto_d, monto_h, cod_caja, descrip, inactivo, co_mone,
            ROUND(( CASE WHEN relacion = 0 THEN saldo_ini1 / ( CASE WHEN @Co_Moneda IS NULL THEN 1
                                                                    ELSE tasa_fec
                                                               END )
                         ELSE saldo_ini1 * ( CASE WHEN @Co_Moneda IS NULL THEN 1
                                                  ELSE tasa_fec
                                             END )
                    END ), 2) AS saldo_ini1, tasa_fec
        FROM
            ( SELECT
                ROUND(SUM(MC.monto_d) * CASE WHEN @Co_Moneda IS NULL
                                             THEN ISNULL(dbo.TasaAUnaFecha(CA.co_mone, 0, @dFecha_h), 0.00000)
                                             ELSE 1.00000
                                        END, 2) AS monto_d,
                ROUND(SUM(MC.monto_h) * CASE WHEN @Co_Moneda IS NULL
                                             THEN ISNULL(dbo.TasaAUnaFecha(CA.co_mone, 0, @dFecha_h), 0.00000)
                                             ELSE 1.00000
                                        END, 2) AS monto_h, CA.cod_caja, CA.descrip, CA.inactivo, CA.co_mone,
                ROUND(dbo.SaldoCajaAUnaFecha(CA.cod_caja, @dFecha_d - 1)
                      * ( CASE WHEN @Co_Moneda IS NULL
                               THEN ISNULL(dbo.TasaAUnaFecha(CA.co_mone, 0.00000, @dFecha_h), 0.00000)
                               ELSE 1.00000
                          END ), 2
```
