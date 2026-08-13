# SP: pObtenerSerialesPorDocumento
**Tipo**: Obtener
**Módulo**: Ventas

## Tablas Referenciadas
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saNotaDespachoVentaReng`](../tables/saNotaDespachoVentaReng.md)
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)
- [`saSeriales`](../tables/saSeriales.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			pObtenerSerailesPorDocumento
DESCRIPCION:	VALIDA EN DOCUMENTOS IMPORTADOS Y NO IMPORTADOS, SI EXISTEN SERIALES ASIGNADOS DESDE SU ORIGEN
CREADO POR:		SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerSerialesPorDocumento]
	( 
		@sTipoDoc CHAR(4),
		@sDocNum  CHAR(20)
	)
AS 
BEGIN

	--NOTA DE ENTREGA
	IF (@sTipoDoc = 'NENT')
		BEGIN
			SELECT FACT.doc_num, SE.doc_tip_s FROM saNotaEntregaVentaReng NENT 
				LEFT JOIN saFacturaVentaReng FACT			ON NENT.ROWGUID		=		FACT.rowguid_doc 
				INNER JOIN saSeriales SE					ON SE.doc_num_s		=		FACT.rowguid
					WHERE NENT.doc_num = @sDocNum 
		END

	--FACTURA DE VENTA
	IF (@sTipoDoc = 'FACT')
		BEGIN
			SELECT NENT.doc_num, SE.doc_tip_s FROM saFacturaVentaReng FACT 
				LEFT JOIN saNotaEntregaVentaReng NENT		ON NENT.ROWGUID		=		FACT.rowguid_doc 
				INNER JOIN saSeriales SE					ON SE.doc_num_s		=		NENT.rowguid
					WHERE FACT.doc_num = @sDocNum 
		END

	--NOTA DE DESPACHO 
	IF (@sTipoDoc = 'NDES')
		BEGIN
				SELECT FACT.doc_num, SE.doc_tip_s FROM saNotaDespachoVentaReng NDES 
					LEFT JOIN saFacturaVentaReng FACT		ON FACT.rowguid		=		NDES.rowguid_doc	AND		FACT.rowguid_doc IS NULL
					INNER JOIN saSeriales SE				ON SE.doc_num_s		=		FACT.rowguid 
						WHERE NDES.doc_num = @sDocNum
					
			UNION ALL
				SELECT NENT.doc_num, SE.doc_tip_s FROM saNotaDespachoVentaReng NDES 
					LEFT JOIN saFacturaVentaReng FACT		ON FACT.ROWGUID		=		NDES.rowguid_doc
					LEFT JOIN saNotaEntregaVentaReng NENT	ON NENT.ROWGUID		=		FACT.rowguid_doc
					INNER JOIN saSeriales SE				ON SE.doc_num_s		=		NENT.rowguid 
						WHERE NDES.doc_num = @sDocNum
		END 
END
```
