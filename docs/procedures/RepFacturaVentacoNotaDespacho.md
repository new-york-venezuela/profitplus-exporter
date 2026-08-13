# SP: RepFacturaVentacoNotaDespacho
**Tipo**: Reporte
**Módulo**: Ventas

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saNotaDespachoVenta`](../tables/saNotaDespachoVenta.md)
- [`saNotaDespachoVentaReng`](../tables/saNotaDespachoVentaReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <03-02-11>
-- Description:	<Facturas de Ventas con sus Nota de Despacho>
-- =============================================
CREATE PROCEDURE [RepFacturaVentacoNotaDespacho]
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

        SELECT
            *
        FROM
            ( SELECT
                NV.doc_num AS num_nota, N.doc_num AS num_doc, FV.doc_num, FV.fec_emis, FV.fec_venc, FV.co_mone, FV.tasa,
                FV.total_neto, FV.co_cli, C.cli_des, 'Nota de Despacho' AS tip, N.total_neto AS neto,
                N.fec_emis AS fecha, NV.reng_neto, N.total_bruto AS bruto, N.tasa AS tasar, N.co_mone AS mone,
                FV.co_sucu_in, 'Factura' AS tipox, FV.co_ven, N.co_ven AS vende
              FROM
                saFacturaVenta AS FV
                INNER JOIN saFacturaVentaReng AS FVR ON FV.doc_num = FVR.doc_num
                                                        AND FV.anulado = 0
                INNER JOIN ( SELECT
                                SUM(( ( prec_vta * total_art ) - monto_desc - monto_desc_glob ) + ( monto_reca_glob
                                                                                                    + otros1_glob
                                                                                                    + otros2_glob
                                                                                                    + otros3_glob )
                                    + ( monto_imp + monto_imp_afec_glob )) AS reng_neto, doc_num, rowguid_doc
                             FROM
                                saNotaDespachoVentaReng
                             WHERE
                                tipo_doc = 'FACT'
                             GROUP BY
                                doc_num, rowguid_doc
                           ) AS NV ON FVR.rowguid = NV.rowguid_doc
                INNER JOIN saNotaDes
```
