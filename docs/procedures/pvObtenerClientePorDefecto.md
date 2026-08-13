# SP: pvObtenerClientePorDefecto
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvParEmp`](../tables/pvParEmp.md)

## Código (excerpt)
```sql
CREATE proc [dbo].[pvObtenerClientePorDefecto] 
/******************************************************************************
* Stored Procedure : Consulta clientes y que precio se va a manejar para él   *
* Fecha Creación   :  20/08/2009                                            *
******************************************************************************/ 
as


select tipo_cliente
from pvParEmp
RETURN
```
