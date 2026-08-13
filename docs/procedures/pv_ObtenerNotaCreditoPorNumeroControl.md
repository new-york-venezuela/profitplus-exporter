# SP: pv_ObtenerNotaCreditoPorNumeroControl
**Tipo**: Punto de Venta
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pv_ObtenerFacturaPorNumeroControl]
*DESCRIPCIÓN	: Consulta si existe alguna factura con el numero de control especificado (store ultilizado en la pantalla de frmNumeroControl.frm de punto de venta
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ObtenerNotaCreditoPorNumeroControl]
	@n_control varchar(20)
AS
BEGIN
	SELECT *
	FROM saDocumentoVenta
	WHERE n_control = @n_control
	AND co_tipo_doc = 'N/CR'
END
```
