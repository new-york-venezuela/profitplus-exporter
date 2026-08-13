# SP: pSeleccionarRenglonesImpuestoSobreVenta
**Tipo**: Seleccionar
**Módulo**: Compras

## Tablas Referenciadas
- [`saCotizacionProveedor`](../tables/saCotizacionProveedor.md)
- [`saImpuestoSobreVentaReng`](../tables/saImpuestoSobreVentaReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pSeleccionarRenglonesImpuestoSobreVenta]
DESCRIPCION: Obtiene los renglones asociados a la tabla  saCotizacionProveedor
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarRenglonesImpuestoSobreVenta]
    (
      @sdFecha SMALLDATETIME
	
    )
AS 
    BEGIN
        SELECT
            *
        FROM
            saImpuestoSobreVentaReng
        WHERE
            fecha = @sdFecha
        ORDER BY
            reng_num ASC
    END
```
