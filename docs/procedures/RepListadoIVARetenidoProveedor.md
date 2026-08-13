# SP: RepListadoIVARetenidoProveedor
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saPagoDocReng`](../tables/saPagoDocReng.md)
- [`saPagoRetenIvaReng`](../tables/saPagoRetenIvaReng.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <22-02-11>
-- Description:	<Listado de IVA Retenido a Proveedores>
-- =============================================

CREATE PROCEDURE [dbo].[RepListadoIVARetenidoProveedor]
	-- Add the parameters for the stored procedure here
    @dFecha_d SMALLDATETIME = NULL ,
    @dFecha_h SMALLDATETIME = NULL ,
    @sCo_prov_d CHAR(16) = NULL ,
    @sCo_prov_h CHAR(16) = NULL ,
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
            '1' AS tipo_reporte, DC.fec_emis, DC.num_comprobante, DC.prov_ter, PDR.nro_doc AS numero, PDR.co_tipo_doc,
            DC.co_prov, isnull(P2.prov_des, P.prov_des) prov_des, PDR1.nro_doc, PDR1.co_tipo_doc AS tipo, ISNULL(PDR1.nro_fact, '') AS nro_fact,
            CASE WHEN DC.anulado = 1 THEN 0.00 ELSE PDR.mont_cob END AS  mont_cob, PR.periodo_impositivo, PR.fecha_documento, PR.tipo_operacion, PR.tipo_documento,
            PR.numero_documento, PR.base_imponible, CASE WHEN DC.anulado = 1 THEN 0.00 ELSE PR.monto_ret_imp END as monto_ret_imp , PR.monto_excento, PR.alicuota, PR.monto_documento,
            DC.total_neto, DC.anulado
        FROM
            saPagoDocReng AS PDR
            INNER JOIN saPagoDocReng AS PDR1 ON PDR.rowguid_reng_ori = PDR1.rowguid
            INNER JOIN saPagoRetenIvaReng AS PR ON PDR.rowguid = PR.Rowguid_reng_cob
            INNER JOIN saDocumentoCompra AS DC ON PDR.nro_doc = DC.nro_doc
                                                  AND DC.co_tipo_doc = PDR.co_tipo_doc
                                                  AND ( PDR.co_tipo_doc = 'IVAN'
                                                        OR PDR.co_tipo_doc = 'IVAP'
                                                      )
            INNER JOIN saProveedor AS P ON DC.co_prov = P.co_prov
            LEFT JOIN saProveedor AS P2 ON DC.prov_ter = P2.co_prov
        WHERE
            ( ( @dFecha_d IS NULL
                OR dbo.FechaSimple(DC.fec_emis) >= @dFecha_d
              )
              AND ( @dFecha_h IS NULL
                    OR dbo.FechaSimple(DC.fec_emis) <= @dFecha_h
```
