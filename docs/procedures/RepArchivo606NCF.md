# SP: RepArchivo606NCF
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saDevolucionProveedorReng`](../tables/saDevolucionProveedorReng.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saNCFInfoDocCompra`](../tables/saNCFInfoDocCompra.md)
- [`saPago`](../tables/saPago.md)
- [`saPagoDocReng`](../tables/saPagoDocReng.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saProveedorExt`](../tables/saProveedorExt.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <24/02/2017>
-- Description:	<DGII Formato de Compras de Bienes y Servicios (606)>
-- =============================================
CREATE PROCEDURE [dbo].[RepArchivo606NCF] 

    @sFecha_d SMALLDATETIME = NULL ,
    @sFecha_h SMALLDATETIME = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
		
			SELECT 
                dcp.co_tipo_doc, dcp.nro_doc, dcp.co_prov, prov.prov_des, prov.rif AS RNC, 
                ISNULL(rdc1.co_gasto,'  ') AS TIPO_GASTO,
				ISNULL(rdc1.NCF,'                   ') AS NCF,
				ISNULL(rdc2.ncf,'                   ') AS NCF_MODIFICADO, 
                dcp.fec_emis AS FECHA_COMPROBANTE, 
                ISNULL(dcp.monto_imp, 0.00) AS ITBIS_FACTURADO, 
                ISNULL(dcp2.total_neto, 0.00) AS ITBIS_RETENIDO, 
                (dcp.total_bruto + dcp.monto_reca - dcp.monto_desc_glob) AS MONTO_FACTURADO, 
                pg.fecha AS FECHA_PAGO, 
                SUM(ISNULL(rpg.monto_retencion_iva, 0.00)) AS RETENCION_RENTA 
            FROM
				saDocumentoCompra dcp 
                INNER JOIN saProveedor prov ON dcp.co_prov = prov.co_prov  
                INNER JOIN saProveedorExt proExt on proExt.rowguid_prov = prov.rowguid 
                INNER JOIN saNCFInfoDocCompra rdc1 ON dcp.co_tipo_doc = rdc1.tipo_doc AND dcp.nro_doc = rdc1.nro_doc
				LEFT JOIN saDevolucionProveedorReng DEV ON DEV.doc_num = dcp.nro_orig AND dcp.doc_orig = 'DEVO'
				LEFT JOIN saFacturaCompraReng FCR ON FCR.rowguid = DEV.rowguid_doc
				LEFT JOIN saNCFInfoDocCompra rdc2 ON rdc2.tipo_doc = 'FACT' AND rdc2.nro_doc = FCR.doc_num
				LEFT JOIN saDocumentoCompra dcp2 ON dcp2.doc_orig = dcp.co_tipo_doc AND dcp2.nro_orig = dcp.nro_doc
					AND dcp2.co_tipo_doc IN ('IVAN', 'IVAP')
					AND dcp2.anulado = 0 
                LEFT JOIN saPagoDocReng rpg ON rpg.co_tipo_doc = dcp.co_tipo_doc AND rpg.nro_doc = dcp.nro_doc  AND rpg.monto_retencion_iva > 0
                LEFT JOIN saPago pg ON pg.cob_num = rpg.cob_num AND pg.anulado = 0
                
            WHERE
				(prov.nacional = 1 OR (prov.nacional = 0 AND proExt.tComp <> '99'))
				AND ( ( @sFecha_d IS NULL
                    OR dbo.FechaSimple(dcp.fec_emis) >= @sFecha_d
                  )
                  AND ( @sFecha_h IS NULL
                        OR dbo.Fecha
```
