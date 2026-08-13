# SP: RepTotalCobroxCliente
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saCobro`](../tables/saCobro.md)
- [`saCobroTPReng`](../tables/saCobroTPReng.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <17/08/2010>
-- LastUpdate : <2020-03-13> 
-- Description:	<Reporte de Total de Pagos por Proveedor>
-- =============================================
CREATE PROCEDURE [dbo].[RepTotalCobroxCliente]
    @dCo_fecha_d SMALLDATETIME = NULL ,
    @dCo_fecha_h SMALLDATETIME = NULL ,
    @sCo_Cli_d CHAR(16) = NULL ,
    @sCo_Cli_h CHAR(16) = NULL ,
    @sCo_Zona_d CHAR(6) = NULL ,
    @sCo_Zona_h CHAR(6) = NULL ,
    @sCo_Segmento_d CHAR(6) = NULL ,
    @sCo_Segmento_h CHAR(6) = NULL ,
    @sCo_Moneda CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sOperacion CHAR(20) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
	
        IF @dCo_fecha_d IS NOT NULL 
            SET @dCo_fecha_d = dbo.FechaSimple(@dCo_fecha_d)
        IF @dCo_fecha_h IS NOT NULL 
            SET @dCo_fecha_h = dbo.FechaSimple(@dCo_fecha_h)

        SELECT
            ISNULL(A.co_cli, B.co_cli) AS co_cli, ISNULL(A.cli_des, B.cli_des) AS cli_des,
            ISNULL(A.anho_venta, B.anho_cobro) AS anho, ISNULL(A.mes_venta, B.mes_cobro) AS mes,
            ISNULL(A.total_venta, 0) AS total_venta, ISNULL(B.total_EF, 0) AS total_EF,
            ISNULL(B.total_CH, 0) AS total_CH, ISNULL(B.total_TJ, 0) AS total_TJ, ISNULL(B.total_DP, 0) AS total_DP,
			ISNULL(B.total_TP , 0) AS total_TP , ISNULL(B.total_CT , 0) AS total_CT
        FROM
            ( SELECT
                P.co_cli, P.cli_des, TVENTAS.anho_venta, TVENTAS.mes_venta, TVENTAS.total_venta
              FROM
                sacliente P
                INNER JOIN ( SELECT
                                DC.co_cli, YEAR(DC.fec_emis) AS anho_venta, MONTH(DC.fec_emis) AS mes_venta,
                                SUM(DC.total_neto) AS total_venta
                             FROM
                                saDocumentoVenta DC
                             WHERE
                                DC.anulado = 0
                                AND DC.co_tipo_doc = 'FACT'
                                AND ( @dCo_fecha_d IS NULL
                                      OR dbo.FechaSimple(DC.fec_emis) >= @dCo_fecha_d
                                    )
                                AND ( @dCo_fecha_h IS NULL
                                      OR dbo.FechaSimple(DC.fec_emis) <= @dCo_fecha_h
```
