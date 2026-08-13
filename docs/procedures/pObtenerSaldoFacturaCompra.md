# SP: pObtenerSaldoFacturaCompra
**Tipo**: Obtener
**Módulo**: Compras

## Tablas Referenciadas
- [`saFacturaCompra`](../tables/saFacturaCompra.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pObtenerSaldoFacturaCompra
DESCRIPCION: Se encarga de obtener el saldo de las facturas de compras
CREADO POR: SOFTECH SISTEMAS.
MODIFICADO POR: SOFTECH SISTEMAS
MODIFICADO EL: 02/08/2016
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerSaldoFacturaCompra] ( @sDocNum CHAR(20) )
AS 
    BEGIN		
        SELECT saldo
        FROM saFacturaCompra
		WHERE doc_num = @sDocNum

    END
```
