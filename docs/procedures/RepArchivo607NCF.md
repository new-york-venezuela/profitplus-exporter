# SP: RepArchivo607NCF
**Tipo**: Reporte
**Módulo**: Ventas

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saNCFInfoDocVenta`](../tables/saNCFInfoDocVenta.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <24/02/2017>
-- Description:	<DGII Formato de Ventas de Bienes y Servicios (607)>
-- =============================================
CREATE PROCEDURE [dbo].[RepArchivo607NCF] 

    @sFecha_d SMALLDATETIME = NULL ,
    @sFecha_h SMALLDATETIME = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
		
		SELECT
			DV.co_tipo_doc, DV.nro_doc, DV.co_cli, CL.cli_des, CL.rif AS RNC,
			ISNULL(NCF.ncf, '                   ') AS NCF,
			ISNULL(NCF2.ncf, '                   ') AS NCF_MODIFICADO,
			DV.fec_emis AS FECHA_COMPROBANTE,
			ISNULL(DV.monto_imp,0.00) AS ITIBIS_FACTURADO,
			ISNULL(((DV.total_bruto + DV.monto_reca) - DV.monto_desc_glob), 0.00) AS MONTO_FACTURADO
		FROM
			saDocumentoVenta DV
			INNER JOIN saCliente CL ON CL.co_cli = DV.co_cli
			INNER JOIN saNCFInfoDocVenta NCF ON NCF.tipo_doc = DV.co_tipo_doc AND NCF.nro_doc = DV.nro_doc
			LEFT JOIN saDevolucionClienteReng DEV ON DEV.doc_num = DV.nro_orig AND DV.doc_orig = 'DEVO'
			LEFT JOIN saFacturaVentaReng FVR ON FVR.rowguid = DEV.rowguid_doc
			LEFT JOIN saNCFInfoDocVenta NCF2 ON NCF2.tipo_doc = 'FACT' AND NCF2.nro_doc = FVR.doc_num
		WHERE
			dv.anulado = 0
			AND ( ( @sFecha_d IS NULL
                    OR dbo.FechaSimple(DV.fec_emis) >= @sFecha_d
                  )
                  AND ( @sFecha_h IS NULL
                        OR dbo.FechaSimple(DV.fec_emis) <= @sFecha_h
                      )
                )
		ORDER BY
			DV.fec_emis
			
		

    END
```
