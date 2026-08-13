# SP: pv_ObtenerValeAlimentacion
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvValeAlimentacion`](../tables/pvValeAlimentacion.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pv_ObtenerValeAlimentacion]
*DESCRIPCIÓN	: SELECCIONA LA LISTA DE CESTATICKET DE LA TABLA 'pvValeAlimentacion' ORDENADOS POR 
				  EL CODIGO DEL VALE    
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ObtenerValeAlimentacion]
AS
BEGIN
	SELECT co_vale AS co_cesta, vale_descrip AS cesta_descrip--, imagen AS imagen
		FROM pvValeAlimentacion  
			WHERE inactivo = 0 
		ORDER BY co_vale
END
```
