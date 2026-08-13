# SP: pv_ObtenerValeAlimentacionMonto
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvValeAlimentacion`](../tables/pvValeAlimentacion.md)
- [`pvValeAlimentacionReng`](../tables/pvValeAlimentacionReng.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pv_ObtenerValeAlimentacionMonto]
*DESCRIPCIÓN	: SELECCIONA LA LISTA DE CESTATICKET CON SU DENOMINACION, NUMERO DE RENGLON, NOMBRE Y ROWGUID
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ObtenerValeAlimentacionMonto]
AS 
BEGIN
	SELECT	Reng.reng_num, 	Reng.valor importe, Reng.co_vale AS codigoticket, 
			E.vale_descrip AS NombreTicket, Reng.rowguid
		FROM pvValeAlimentacionReng Reng INNER JOIN 
			 pvvalealimentacion E ON Reng.co_vale = E.co_vale 
			WHERE E.inactivo = 0  AND Reng.inactivo = 0
				ORDER BY Reng.co_vale, Reng.valor
END
```
