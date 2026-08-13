# SP: pv_ObtenerCajasMoneda
**Tipo**: Punto de Venta
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCaja`](../tables/saCaja.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pv_ObtenerCajasMoneda
*CREACIÓN		:	<2020-08-07>
*DESCRIPCIÓN	:	OBTIENE LAS CAJAS POR EL CODIGO DE LA MONEDA
*AUTOR			:	SOFTECH SISTEMAS
********************************************************************/
CREATE PROCEDURE [dbo].[pv_ObtenerCajasMoneda] 
@sCo_Mone CHAR(6) = NULL
AS 
BEGIN
  SELECT [cod_caja] ,[descrip], [descrip] AS caja  
  FROM [dbo].[saCaja]
  WHERE @sCo_Mone = co_mone AND inactivo = 0
END
```
