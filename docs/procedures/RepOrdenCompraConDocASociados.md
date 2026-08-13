# SP: RepOrdenCompraConDocASociados
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saNotaRecepcionCompra`](../tables/saNotaRecepcionCompra.md)
- [`saNotaRecepcionCompraReng`](../tables/saNotaRecepcionCompraReng.md)
- [`saOrdenCompra`](../tables/saOrdenCompra.md)
- [`saOrdenCompraReng`](../tables/saOrdenCompraReng.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <23-11-10>
-- Description:	<Ordenes de compra con sus Documentos Asociados>
-- =============================================
CREATE PROCEDURE [RepOrdenCompraConDocASociados]
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
            A.*, 'Orden de Compra' as tipo
        FROM
            ( SELECT
                NV.doc_num AS num_doc, C.doc_num, N.fec_emis, C.fec_venc, C.co_mone, C.tasa, C.total_neto, C.co_prov,
                PV.prov_des, 'Nota de Recepción' AS tip, N.total_neto AS neto, N.fec_emis AS fecha, NV.reng_neto,
                N.total_bruto AS bruto, N.tasa AS tasar, N.co_mone AS mone, C.co_sucu_in, 'compra' AS tipox
              FROM
                saOrdenCompra AS C
                INNER JOIN saOrdenCompraReng AS CR ON C.doc_num = CR.doc_num
                                                      AND C.anulado = 0
                INNER JOIN ( SELECT
                                PR.doc_num, PR.rowguid_doc,
                                SUM(( PR.cost_unit * PR.total_art ) + PR.monto_imp + PR.monto_imp_afec_glob
                                    + PR.otros1_glob + PR.otros2_glob + PR.otros3_glob + -PR.monto_desc
                                    - PR.monto_desc_glob) AS reng_neto
                             FROM
                                saNotaRecepcionCompraReng AS PR
                             WHERE
                                PR.tipo_doc = 'OCOM'
                             GROUP BY
                                PR.doc_num, PR.rowguid_doc
                           ) AS NV ON CR.rowguid = NV.rowguid_doc
                INNER JOIN saNotaRecepcionCompra AS N ON NV.doc_num = N.doc_num
                INNER JOIN saProveedor AS PV ON C.co_prov = PV.co_prov
              WHERE
```
