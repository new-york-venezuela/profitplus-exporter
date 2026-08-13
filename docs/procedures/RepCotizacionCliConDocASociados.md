# SP: RepCotizacionCliConDocASociados
**Tipo**: Reporte
**Módulo**: Ventas

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saCotizacionCliente`](../tables/saCotizacionCliente.md)
- [`saCotizacionClienteReng`](../tables/saCotizacionClienteReng.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saNotaEntregaVenta`](../tables/saNotaEntregaVenta.md)
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)
- [`saPedidoVenta`](../tables/saPedidoVenta.md)
- [`saPedidoVentaReng`](../tables/saPedidoVentaReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <04-10-10>
-- Description:	<Cotizaciones a Clientes con sus Documentos Asociados>
-- =============================================
CREATE PROCEDURE [dbo].[RepCotizacionCliConDocASociados]
	-- Add the parameters for the stored procedure here
    @sNumero_d CHAR(20) = NULL ,
    @sNumero_h CHAR(20) = NULL ,
    @dFecha_d SMALLDATETIME = NULL ,
    @dFecha_h SMALLDATETIME = NULL ,
    @sCo_cli_d CHAR(16) = NULL ,
    @sCo_cli_h CHAR(16) = NULL ,
    @sCo_ven_d CHAR(6) = NULL ,
    @sCo_ven_h CHAR(6) = NULL ,
    @sCo_mone CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        IF @dFecha_h IS NOT NULL 
            SET @dFecha_h = DATEADD(ss, -60, DATEADD(day, 1, @dFecha_h))


        SELECT
            A.*, 'Cotizacion' as tipo
        FROM
            ( SELECT
                PR.doc_num AS num_doc, C.doc_num, C.fec_emis, C.co_ven, C.fec_venc, C.co_mone, C.tasa, C.total_neto,
                C.co_cli, CL.cli_des, 'Pedido' AS tip, P.total_neto AS neto, P.co_ven AS vende, P.fec_emis AS fecha,
                PR.reng_neto, P.total_bruto AS bruto, P.tasa AS tasar, P.co_mone AS mone, C.co_sucu_in, 'FAC' AS tipox
              FROM
                saCotizacionCliente AS C
                INNER JOIN saCotizacionClienteReng AS CR ON C.doc_num = CR.doc_num
                                                            AND C.anulado = 0
                INNER JOIN ( SELECT
                                SUM(( PR.prec_vta * PR.total_art ) + PR.monto_imp + PR.monto_imp_afec_glob
                                    + PR.otros1_glob + PR.otros2_glob + PR.otros3_glob + -PR.monto_desc
                                    - PR.monto_desc_glob) AS reng_neto, PR.doc_num, PR.rowguid_doc
                             FROM
                                saPedidoVentaReng AS PR
                             WHERE
                                PR.tipo_doc = 'CCLI'
                             GROUP BY
                                PR.doc_num, PR.rowguid_doc
                           ) AS PR ON CR.rowguid = PR.rowguid_doc
                INNER JOIN saPedidoVenta AS P ON PR.doc_num = P.doc_num
                INNER JOIN saCliente AS CL ON C.co_cli = CL.co_cli
              WHERE
                C.anulado
```
