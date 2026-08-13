# SP: pv_ObtenerFacturaPorNumeroControl
**Tipo**: Punto de Venta
**Módulo**: Ventas

## Tablas Referenciadas
- [`saFacturaVenta`](../tables/saFacturaVenta.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pv_ObtenerFacturaPorNumeroControl]
*DESCRIPCIÓN	: Consulta si existe alguna factura con el numero de control especificado (store ultilizado en la pantalla de frmNumeroControl.frm de punto de venta
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ObtenerFacturaPorNumeroControl]
	@n_control varchar(20)
AS
BEGIN
	SELECT *
	FROM saFacturaVenta
	WHERE n_control = @n_control
END
```
