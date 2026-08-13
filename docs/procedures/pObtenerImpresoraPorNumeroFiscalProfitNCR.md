# SP: pObtenerImpresoraPorNumeroFiscalProfitNCR
**Tipo**: Obtener
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerImpresoraPorNumeroFiscalProfitNCR]
DESCRIPCION: Obtiene la impresora desde la cual se imprimió una factura a partir de su número fiscal.
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerImpresoraPorNumeroFiscalProfitNCR]
(
	@sNumeroFiscal char(8) = null,
	@sNumeroProfit char(20) = null , 
	@sImpFis char(20) = null 
)
AS
	BEGIN
		IF  @sNumeroFiscal IS NOT NULL
			BEGIN
				SELECT
					impfis
				FROM
					sadocumentoventa
				WHERE
					co_tipo_doc = 'N/CR' and
					impfisfac = @sNumeroFiscal		
					AND impfis = @sImpFis
			END
		ELSE
			BEGIN
				SELECT
					impfis
				FROM
					sadocumentoventa
				WHERE
					co_tipo_doc = 'N/CR' and
					nro_doc = @sNumeroProfit
					AND impfis = @sImpFis
			END
	END
```
