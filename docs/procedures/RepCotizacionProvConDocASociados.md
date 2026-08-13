# SP: RepCotizacionProvConDocASociados
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saCotizacionProveedor`](../tables/saCotizacionProveedor.md)
- [`saCotizacionProveedorReng`](../tables/saCotizacionProveedorReng.md)
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
-- Description:	<Cotizaciones a Clientes con sus Documentos Asociados>
-- =============================================
CREATE PROCEDURE [dbo].[RepCotizacionProvConDocASociados]
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


        IF @dFecha_h IS NOT NULL 
            SET @dFecha_h = DATEADD(ss, -60, DATEADD(day, 1, @dFecha_h))

        SELECT
            *
        FROM
            ( SELECT
                PR.doc_num AS num_doc, C.doc_num, C.fec_emis, C.fec_venc, C.co_mone, C.tasa, C.total_neto, C.co_prov,
                PV.prov_des, 'Orden de Compra' AS tip, P.total_neto AS neto, P.fec_emis AS fecha, PR.reng_neto,
                P.total_bruto AS bruto, P.tasa AS tasar, P.co_mone AS mone, C.co_sucu_in, 'FAC' AS tipox
              FROM
                saCotizacionProveedor AS C
                INNER JOIN saCotizacionProveedorReng AS CR ON C.doc_num = CR.doc_num
                                                              AND C.anulado = 0
                INNER JOIN ( SELECT
                                SUM(( PR.cost_unit * PR.total_art ) + PR.monto_imp + PR.monto_imp_afec_glob
                                    + PR.otros1_glob + PR.otros2_glob + PR.otros3_glob + -PR.monto_desc
                                    - PR.monto_desc_glob) AS reng_neto, PR.doc_num, PR.rowguid_doc
                             FROM
                                saOrdenCompraReng AS PR
                             WHERE
                                PR.tipo_doc = 'CPRO'
                             GROUP BY
                                PR.doc_num, PR.rowguid_doc
                           ) AS PR ON CR.rowguid = PR.rowguid_doc
                INNER JOIN saOrdenCompra AS P ON PR.doc_num = P.doc_num
                INNER JOIN saProveedor AS PV ON C.co_prov = PV.co_prov
              WHERE
                C.anulado = 0
                AND ( ( @sNumero_d IS NULL
                        OR C.doc_num >= @sNu
```
