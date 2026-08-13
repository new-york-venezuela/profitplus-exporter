# SP: RepPedidoConFacturaNotaEntrega
**Tipo**: Reporte
**Módulo**: Ventas

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
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
-- Description:	<Pedidos con sus facturas y Notas de entrega>
-- =============================================
CREATE PROCEDURE [dbo].[RepPedidoConFacturaNotaEntrega]
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
            A.*, 'venta' AS tipo_rep
        FROM
            ( SELECT
                PR.doc_num AS num_nota, PR.doc_num AS num_doc, 
				p.doc_num, dbo.fechasimple(P.fec_emis) as fec_emis, 
				P.co_ven, 
				dbo.fechasimple(P.fec_venc) as fec_venc, 
				P.co_mone,
                P.tasa, P.total_neto, P.co_cli, C.cli_des, 'Factura' AS tip, F.total_neto AS neto, F.co_ven AS vende,
                F.fec_emis AS fecha, PR.reng_neto, F.total_bruto AS bruto, F.tasa AS tasar, F.co_mone AS mone,
                P.co_sucu_in, 'FAC' AS tipox
              FROM
                saPedidoVenta AS P
                INNER JOIN saPedidoVentaReng AS CR ON P.doc_num = CR.doc_num
                                                      AND P.anulado = 0
                INNER JOIN ( SELECT
                                SUM(( PR.prec_vta * PR.total_art ) + PR.monto_imp + PR.monto_imp_afec_glob
                                    + PR.otros1_glob + PR.otros2_glob + PR.otros3_glob + -PR.monto_desc
                                    - PR.monto_desc_glob) AS reng_neto, PR.doc_num, PR.rowguid_doc
                             FROM
                                saFacturaVentaReng AS PR
                             WHERE
                                PR.tipo_doc = 'PCLI'
                             GROUP BY
                                PR.doc_num, PR.rowguid_doc
                           ) AS PR ON CR.rowguid = PR.rowguid_doc
                INNER JOIN saFacturaVenta AS F ON PR.doc_num = F.doc_num
                I
```
