# SP: pValidarRenglonImportacion
**Tipo**: Validar
**Módulo**: Compras

## Tablas Referenciadas
- [`saArtImportacion`](../tables/saArtImportacion.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraImportacion`](../tables/saFacturaCompraImportacion.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saPlantillaCompra`](../tables/saPlantillaCompra.md)
- [`saPlantillaCompraReng`](../tables/saPlantillaCompraReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			pValidarRenglonImportacion
DESCRIPCION:	Procedimiento que valida la consistencia del saldo en Banco
CREADO POR:		SOFTECH SISTEMAS
***************************************************************************************************************/

CREATE PROCEDURE [dbo].[pValidarRenglonImportacion]
    @sDoc_num CHAR(20) , 
    @iReng_num INT ,
	@sCo_tipo_doc CHAR(6)
AS 
    BEGIN
		
		IF @sCo_tipo_doc = 'FACT' -- Importa de Factura de compra
			SELECT 
					COALESCE(saArtImportacion.co_incoterm, saFacturaCompraImportacion.co_incoterm) AS Co_incoterm

			FROM	saFacturaCompra LEFT JOIN
					saFacturaCompraImportacion   ON saFacturaCompra.doc_num = saFacturaCompraImportacion.doc_num INNER JOIN
					saFacturaCompraReng          ON saFacturaCompra.doc_num = saFacturaCompraReng.doc_num LEFT JOIN
					saArtImportacion             ON saFacturaCompraReng.co_art = saArtImportacion.co_art
			WHERE
					saFacturaCompraReng.doc_num = @sDoc_num
					AND saFacturaCompraReng.reng_num = @iReng_num
					--AND saFacturaCompraImportacion.co_tipo_doc = @sCo_tipo_doc
		ELSE  --Importa de plantilla de compra
			SELECT 
					COALESCE(saArtImportacion.co_incoterm, saFacturaCompraImportacion.co_incoterm) AS Co_incoterm

			FROM	saPlantillaCompra LEFT JOIN
					saFacturaCompraImportacion   ON saPlantillaCompra.doc_num = saFacturaCompraImportacion.doc_num INNER JOIN
					saPlantillaCompraReng        ON saPlantillaCompra.doc_num = saPlantillaCompraReng.doc_num LEFT JOIN
					saArtImportacion             ON saPlantillaCompraReng.co_art = saArtImportacion.co_art
			WHERE
					saPlantillaCompraReng.doc_num = @sDoc_num
					AND saPlantillaCompraReng.reng_num = @iReng_num
					--AND saFacturaCompraImportacion.co_tipo_doc = @sCo_tipo_doc
        

    END
```
