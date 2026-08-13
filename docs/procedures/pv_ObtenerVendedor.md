# SP: pv_ObtenerVendedor
**Tipo**: Punto de Venta
**Módulo**: Clientes

## Tablas Referenciadas
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pv_ObtenerVendedor]
*DESCRIPCIÓN	: OBTIENE UNA LISTA DE LOS VENDEDORES CARGADOS EN LA TABLA 'saVendedor'
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ObtenerVendedor]
AS
BEGIN

       SELECT co_ven, ven_des, fun_cob, fun_ven FROM saVendedor
       where inactivo=0
       ORDER BY co_ven ASC
END
```
