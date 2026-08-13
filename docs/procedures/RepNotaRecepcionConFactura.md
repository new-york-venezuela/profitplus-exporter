# SP: RepNotaRecepcionConFactura
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saNotaRecepcionCompra`](../tables/saNotaRecepcionCompra.md)
- [`saNotaRecepcionCompraReng`](../tables/saNotaRecepcionCompraReng.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <04-10-10>
-- Description:	<Notas de Entrega con sus facturas>
-- =============================================
CREATE PROCEDURE [RepNotaRecepcionConFactura]
	-- Add the parameters for the stored procedure here
    @sNumero_d CHAR(20) = NULL ,
    @sNumero_h CHAR(20) = NULL ,
    @dFecha_d SMALLDATETIME = NULL ,
    @dFecha_h SMALLDATETIME = NULL ,
    @sCo_prov_d CHAR(16) = NULL ,
    @sCo_prov_h CHAR(16) = NULL ,
    @sCo_mone CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        IF @dFecha_d IS NOT NULL 
            SET @dFecha_d = dbo.FechaSimple(@dFecha_d)
        IF @dFecha_h IS NOT NULL 
            SET @dFecha_h = dbo.FechaSimple(@dFecha_h)

        SELECT
            *
        FROM
            ( SELECT
                FR.doc_num AS num_doc, N.doc_num, N.fec_emis, N.fec_venc, N.co_mone, N.tasa, N.total_neto, N.co_prov,
                PV.prov_des, 'Factura' AS tip, F.total_neto AS neto, F.fec_emis AS fecha, FR.reng_neto,
                F.total_bruto AS bruto, F.tasa AS tasar, F.co_mone AS mone, N.co_sucu_in, 'compra' AS tipox
              FROM
                saNotaRecepcionCompra AS N
                INNER JOIN saNotaRecepcionCompraReng AS CR ON N.doc_num = CR.doc_num
                                                              AND N.anulado = 0
                INNER JOIN ( SELECT
                                PR.doc_num, PR.rowguid_doc,
                                SUM(( PR.cost_unit * PR.total_art ) + PR.monto_imp + PR.monto_imp_afec_glob
                                    + PR.otros1_glob + PR.otros2_glob + PR.otros3_glob + -PR.monto_desc
                                    - PR.monto_desc_glob) AS reng_neto
                             FROM
                                saFacturaCompraReng AS PR
                             WHERE
                                PR.tipo_doc = 'NREC'
                             GROUP BY
                                PR.doc_num, PR.rowguid_doc
                           ) AS FR ON CR.rowguid = FR.rowguid_doc
                INNER JOIN saFacturaCompra AS F ON FR.doc_num = F.doc_num
                INNER JOIN saProveedor AS PV ON N.co_prov = PV.co_prov
              WHERE
                N.anulado = 0
                AN
```
