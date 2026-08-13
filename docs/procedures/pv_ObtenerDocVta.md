# SP: pv_ObtenerDocVta
**Tipo**: Punto de Venta
**Módulo**: Ventas

## Tablas Referenciadas
- [`pvFacturaVentaExt`](../tables/pvFacturaVentaExt.md)
- [`saCliente`](../tables/saCliente.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saDocumentoVentaInfoIGTF`](../tables/saDocumentoVentaInfoIGTF.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pv_ObtenerDoctVta]
*DESCRIPCIÓN	: BUSCA LOS DATOS DEL ENCABEZADO DE UNA FACTURA DADA CON ESTADO PROCESADO
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ObtenerDocVta]
(
	@sDocNum		CHAR(20)
)
AS
BEGIN
	SELECT DOCV.rowguid, 
				DOCV.validador, 
				DOCV.nro_doc doc_num, 
				DOCV.fec_emis, 
				DOCV.co_cli, 
				DOCV.co_mone, 
				DOCV.co_ven, 			 
				FAC.comentario,
				DOCV.impfis, 
				DOCV.impfisfac, 		
				DOCV.total_bruto,
				DOCV.total_neto,
				DOCV.monto_imp,
				ISNULL(DOCV.porc_desc_glob, 0) AS porc_desc_glob, 
				DOCV.monto_desc_glob,
				ISNULL(DOCV.porc_reca, 0) AS porc_reca, 
				DOCV.monto_reca,
				DOCV.tasa,
				FAC.co_tran,
				FAC.co_cond, 
				ISNULL(FAC.dir_ent,'') dir_ent, 
				CLI.cli_des, 
				CLI.contrib,
				CLI.tip_cli,
				--DOCV.otros1, --DN 250422
				case 
				  when (isnull(DOCVIG.base_imponible,0) > 0) then 
				       0
				  else
					   DOCV.otros1 end as otros1,
				isnull(DOCVIG.base_imponible,0) as base_imponible, --DN 250422
				isnull(DOCVIG.porc_aplic,0) as porc_aplic, --DN 250422 
				case 
				  when (isnull(DOCVIG.base_imponible,0) > 0) then 
				        DOCV.otros1 
				  else
					    0 end as dIgtf
	FROM saDocumentoVenta AS DOCV 
				INNER JOIN safacturaventa FAC on DOCV.nro_doc = FAC.doc_num 
				left outer JOIN saDocumentoVentaInfoIGTF DOCVIG on DOCV.rowguid=DOCVIG.rowguid --DN 250422
				INNER JOIN saCliente AS CLI ON FAC.co_cli = CLI.co_cli
				INNER JOIN pvFacturaVentaExt FactExt ON FactExt.rowguid_doc_num = FAC.rowguid
		WHERE FAC.doc_num = @sDocNum AND FAC.anulado = 0 AND 
					EXISTS (SELECT * FROM saFacturaVentaReng RENG WHERE RENG.doc_num = FAC.doc_num
								AND RENG.total_dev < RENG.total_art)
				AND Fac.anulado = 0 
				AND FactExt.estado = 'P'
				AND DOCV.co_tipo_doc = 'FACT'
END
```
