# SP: pv_ObtenerMovCajaMontoD
**Tipo**: Punto de Venta
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	[pv_ObtenerMovCajaMontoD]
*DESCRIPCIÓN	:	OBTIENE LA CAJA Y EL MONTO DEBE GENERADO POR UN MOV DE CAJA AL MOMENTO DE PROCESAR UNA DEVOLUCION DE DINERO
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ObtenerMovCajaMontoD]
(
      @sMovNum CHAR(20)
)
AS 
    BEGIN
		SELECT cod_caja, monto_d 
			FROM saMovimientoCaja WHERE mov_num = @sMovNum
	END
```
