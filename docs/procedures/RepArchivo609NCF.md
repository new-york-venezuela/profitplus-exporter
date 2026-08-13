# SP: RepArchivo609NCF
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
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
-- Description:	<DGII Formato de Envío de Pagos al Exterior (609)>
-- =============================================
CREATE PROCEDURE [dbo].[RepArchivo609NCF] 

    @sFecha_d SMALLDATETIME = NULL ,
    @sFecha_h SMALLDATETIME = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
		
												
				SELECT 
					dcp.nro_doc, CAST(prov.prov_des AS CHAR(30)) AS RAZON_SOCIAL,  
					ISNULL(rdc.co_gasto,'  ') AS TIPO_GASTO,
					dcp.fec_emis AS FECHA_COMPROBANTE, 
					pg.fecha AS FECHA_ISLR,
					rpg.monto_retencion AS MONTO_ISLR, 
					ISNULL((dcp.total_bruto + dcp.monto_reca - dcp.monto_desc_glob), 0.00) AS MONTO_FACTURADO
                FROM
					saDocumentoCompra dcp  
					INNER JOIN saProveedor prov ON dcp.co_prov = prov.co_prov AND prov.inactivo = 0
					INNER JOIN saProveedorExt provExt on provExt.rowguid_prov = prov.rowguid 
					INNER JOIN saNCFInfoDocCompra rdc ON rdc.tipo_doc = dcp.co_tipo_doc AND rdc.nro_doc = dcp.nro_doc
					LEFT JOIN saPagoDocReng rpg ON dcp.nro_doc = rpg.nro_doc AND dcp.co_tipo_doc = rpg.co_tipo_doc AND rpg.monto_retencion_iva > 0
					LEFT JOIN saPago pg ON pg.cob_num = rpg.cob_num AND pg.anulado = 0 
                
                WHERE
					dcp.co_tipo_doc = 'FACT'
					AND prov.nacional = 0 
					AND dcp.anulado = 0
					AND provExt.tComp = 'NM'
					AND 
					(
						( @sFecha_d IS NULL
							OR dbo.FechaSimple(dcp.fec_emis) >= @sFecha_d
						)
						AND
						( @sFecha_h IS NULL
							OR dbo.FechaSimple(dcp.fec_emis) <= @sFecha_h
						)
					)
                ORDER BY
					pg.fecha 
			
		

    END
```
