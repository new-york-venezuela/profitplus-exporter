# SP: pv_RecuperarObtenerDocumentoVenta
**Tipo**: Punto de Venta
**Módulo**: Ventas

## Tablas Referenciadas
- [`pvFacturaVentaExt`](../tables/pvFacturaVentaExt.md)
- [`saCliente`](../tables/saCliente.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saDocumentoVentaInfoIGTF`](../tables/saDocumentoVentaInfoIGTF.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	pv_ObtenerDocumentoVenta
*DESCRIPCIÓN	:	OBTIENE UN DOCUMENTO DE VENTA DE TIPO FACT SEGUN NUMERO QUE LLEGA POR PARAMETRO
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/ 
CREATE PROCEDURE [dbo].[pv_RecuperarObtenerDocumentoVenta]
    (
      @sNro_Doc			CHAR(20)
    )
AS 
    BEGIN
		SELECT dv.*, CLI.cli_des, F.dir_ent, F.comentario,DVigtf.base_imponible 
			FROM
				saDocumentoVenta DV
				INNER JOIN saCliente CLI ON dv.co_cli = CLI.co_Cli
				LEFT JOIN saFacturaVenta F ON F.doc_num = DV.nro_doc AND  DV.Co_Tipo_Doc = 'FACT'
				left join saDocumentoVentaInfoIGTF DVigtf on DV.rowguid = DVigtf.rowguid
				INNER JOIN pvFacturaVentaExt FE ON FE.rowguid_doc_num = F.rowguid
					WHERE
						dv.nro_doc = @sNro_Doc AND 
						dv.co_tipo_doc = 'FACT' 
			ORDER BY
				dv.co_tipo_doc, dv.nro_doc
    END
```
