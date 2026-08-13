# SP: pv_ObtenerDenominacionXMoneda
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvDenominacionesMoneda`](../tables/pvDenominacionesMoneda.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	[pv_ObtenerDenominacionXMoneda]
*DESCRIPCIÓN	:	OBTIENE LAS DENOMINACIONES MANEJADAS POR UNA MONEDA DADA.
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ObtenerDenominacionXMoneda] 
( 
	@sCo_Mone CHAR(6) 
)
AS 
    BEGIN
        SELECT *
			FROM pvDenominacionesMoneda
				WHERE co_mone = @sCo_Mone    
    END
```
