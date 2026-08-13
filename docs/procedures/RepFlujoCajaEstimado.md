# SP: RepFlujoCajaEstimado
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saBeneficiario`](../tables/saBeneficiario.md)
- [`saCliente`](../tables/saCliente.md)
- [`saOrdenPago`](../tables/saOrdenPago.md)
- [`saOrdenPagoReng`](../tables/saOrdenPagoReng.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: RepFlujoCajaEstimado
DESCRIPCION: Reporte de Flujo de Caja Estimado
CREADO POR: SOFTECH SISTEMAS
CREATE DATE: 2011-12-12
LAST DATE:2017-06-27
***************************************************************************************************************/ 
CREATE PROCEDURE [dbo].[RepFlujoCajaEstimado]
    (
      @dfecha DATETIME = NULL ,
      @IIngreso decimal(18,2) = 000000000000.00 ,
      @IEngreso decimal(18,2) = 000000000000.00 ,
	  @bHeaderRep BIT = 0
    )
AS 
    BEGIN

	SET NOCOUNT ON;

        SELECT
           @IIngreso AS Ingreso, @IEngreso AS Egreso, cobrar, pagar, orden
        FROM
            ( SELECT
                ISNULL(SUM(dbo.SaldoProveedorAUnaFecha(co_prov, @dfecha)),0.00) AS Pagar
              FROM
                saProveedor AS P
            ) AS cobrar ,
            ( SELECT
                ISNULL(SUM(dbo.SaldoClienteAUnaFecha(co_cli, @dfecha)),0.00) AS Cobrar
              FROM
                saCliente
            ) AS pagar ,
            ( SELECT
                ISNULL(SUM(( A.monto_d - A.monto_h ) * tasa_fec),0.00) AS orden
              FROM
                ( SELECT
                    CASE WHEN [dbo].[ObtenerMonedaBase]() = OP.co_mone
                         THEN ROUND(SUM(PR.monto_h), 2) * ISNULL(dbo.TasaAUnaFecha(op.co_mone, 0, @dfecha), 0.00000)
                         ELSE ( SUM(PR.monto_h) * ISNULL(dbo.TasaAUnaFecha(OP.co_mone, 0, @dfecha), 0.00000) )
                    END AS monto_h,
                    CASE WHEN [dbo].[ObtenerMonedaBase]() = OP.co_mone
                         THEN ROUND(SUM(PR.monto_d), 2) * ISNULL(dbo.TasaAUnaFecha(op.co_mone, 0, @dfecha), 0.00000)
                         ELSE ( SUM(PR.monto_d) * ISNULL(dbo.TasaAUnaFecha(OP.co_mone, 0, @dfecha), 0.00000) )
                    END AS monto_d, ISNULL(dbo.TasaAUnaFecha(OP.co_mone, 0, @dfecha), 0.00000) AS tasa_fec
                  FROM
                    saOrdenPagoReng AS PR
                    INNER JOIN saOrdenPago OP ON PR.ord_num = OP.ord_num
                                                 AND op.anulado = 0
                                                 AND op.status <> 'C'
                    INNER JOIN saBeneficiario AS B ON OP.cod_ben = B.cod_ben
                  WHERE
                    ( @dfecha IS NULL
                      OR OP.fecha <= @dfecha
```
