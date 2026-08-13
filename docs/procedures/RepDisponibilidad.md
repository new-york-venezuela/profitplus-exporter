# SP: RepDisponibilidad
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)
- [`saBeneficiario`](../tables/saBeneficiario.md)
- [`saCaja`](../tables/saCaja.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)
- [`saOrdenPago`](../tables/saOrdenPago.md)
- [`saOrdenPagoReng`](../tables/saOrdenPagoReng.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saSegmento`](../tables/saSegmento.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <2013-11-05>
-- Description:	<Disponibilidad>
-- LAST DATE:2017-06-27
-- =============================================
CREATE PROCEDURE [dbo].[RepDisponibilidad]
    (
  
      @dfecha DATETIME = NULL ,
      @Itasa INT = 0.00 ,
      @bHeaderRep BIT = 0
    )
AS 
    BEGIN
	
	SET NOCOUNT ON;
 
        SELECT
            *
        FROM
            ( SELECT
                'Ingreso' AS tipo, 'Saldo Cajas' AS nombre, SUM(( A.monto_h - A.monto_d )) AS saldoCaja,
                SUM(A.monto_hOM - A.monto_dOM) AS saldoCajaOM, A.cod_caja, A.descrip
              FROM
                ( SELECT
                    CASE WHEN [dbo].[ObtenerMonedaBase]() = CA.co_mone THEN 0.00
                         ELSE ROUND(SUM(MC.monto_h), 2)
                    END AS monto_hOM, CASE WHEN [dbo].[ObtenerMonedaBase]() = CA.co_mone THEN 0.00
                                           ELSE ROUND(SUM(MC.monto_d), 2)
                                      END AS monto_dOM,
                    CASE WHEN [dbo].[ObtenerMonedaBase]() = CA.co_mone
                         THEN ROUND(SUM(MC.monto_h) * ISNULL(dbo.TasaAUnaFecha(CA.co_mone, 0, @dfecha), 0.00000), 2)
                         ELSE ( SUM(MC.monto_h) * ( CASE WHEN @Itasa IS NULL
                                                              OR @Itasa = 0.00
                                                         THEN ISNULL(dbo.TasaAUnaFecha(CA.co_mone, 0, @dfecha), 0.00000)
                                                         ELSE @Itasa
                                                    END ) )
                    END AS monto_h,
                    CASE WHEN [dbo].[ObtenerMonedaBase]() = CA.co_mone
                         THEN ROUND(SUM(MC.monto_d) * ISNULL(dbo.TasaAUnaFecha(CA.co_mone, 0, @dfecha), 0.00000), 2)
                         ELSE ( SUM(MC.monto_d) * ( CASE WHEN @Itasa IS NULL
                                                              OR @Itasa = 0.00
                                                         THEN ISNULL(dbo.TasaAUnaFecha(CA.co_mone, 0, @dfecha), 0.00000)
                                                         ELSE @Itasa
                                                    END ) )
                    END AS monto_d, ISNULL(dbo.TasaAUnaFecha(CA.co_mone, 0.00000, @dfecha), 0.00000) AS tasa_fec,
                    CA.cod_caja, CA.descrip
      FROM
```
