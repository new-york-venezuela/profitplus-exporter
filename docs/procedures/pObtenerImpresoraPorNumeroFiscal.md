# SP: pObtenerImpresoraPorNumeroFiscal
**Tipo**: Obtener
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerImpresoraPorNumeroFiscal]
DESCRIPCION: Obtiene la impresora desde la cual se imprimió una factura a partir de su número fiscal.
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerImpresoraPorNumeroFiscal]
(
	@sNumeroFiscal char(8) , 
	@sImpFis char(20)
)
AS 
	BEGIN
		SELECT
			impfis
		FROM
			sadocumentoventa
		WHERE
			co_tipo_doc = 'FACT' and
			impfisfac = @sNumeroFiscal
			and impfis = @sImpFis
		
	END
```
