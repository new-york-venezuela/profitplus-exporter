# SP: RepFacturaCompraConDevolucion
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saDevolucionProveedor`](../tables/saDevolucionProveedor.md)
- [`saDevolucionProveedorReng`](../tables/saDevolucionProveedorReng.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <03-02-11>
-- Description:	<Facturas de Compra con sus Devoluciones>
-- =============================================
CREATE PROCEDURE [RepFacturaCompraConDevolucion]
	-- Add the parameters for the stored procedure here
    @sNumero_d CHAR(20) = NULL ,
    @sNumero_h CHAR(20) = NULL ,
    @dFecha_d DATETIME = NULL ,
    @dFecha_h DATETIME = NULL ,
    @sCo_cli_d CHAR(16) = NULL ,
    @sCo_cli_h CHAR(16) = NULL ,
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
                NV.doc_num AS num_nota, N.doc_num AS num_doc, P.doc_num, 
				dbo.fechasimple(P.fec_emis) as fec_emis, 
				dbo.fechasimple(P.fec_venc) as fec_venc, 
				P.co_mone, P.tasa,
                P.total_neto, P.co_prov AS co_cli, C.prov_des AS cli_des, 'Devolución' AS tip, N.total_neto AS neto,
                dbo.fechasimple(N.fec_emis) AS fecha, NV.reng_neto, N.total_bruto AS bruto, N.tasa AS tasar, N.co_mone AS mone,
                'Factura' AS co_sucu_in, 'compra' AS tipox
              FROM
                saFacturaCompra AS P
                INNER JOIN saFacturaCompraReng AS PR ON PR.doc_num = P.doc_num
                                                        AND P.anulado = 0
                INNER JOIN ( SELECT
                                SUM(( ( cost_unit * total_art ) - monto_desc - monto_desc_glob ) + ( monto_reca_glob
                                                                                                     + otros1_glob
                                                                                                     + otros2_glob
                                                                                                     + otros3_glob )
                                    + ( monto_imp + monto_imp_afec_glob )) AS reng_neto, doc_num, rowguid_doc
                             FROM
                                saDevolucionProveedorReng
                             WHERE
                                tipo_doc = 'COMP'
                             GROUP BY
                                doc_num, rowguid_doc
                           ) AS NV ON PR.rowguid = NV.rowguid_doc
                INNER JOIN saDev
```
