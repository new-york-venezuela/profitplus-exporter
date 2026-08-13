# SP: pv_ObtenerDevClienteMovNumC
**Tipo**: Punto de Venta
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	[pv_ObtenerDevClienteMovNumC]
*DESCRIPCIÓN	:	OBTIENE EL NUMERO DE MOV DE CAJA ASOCIADO A UNA DEVOLUCION DE CLIENTE (MOV DE EGRESO GENERADO POR EL PROCESAR DEV. DINERO)
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ObtenerDevClienteMovNumC]
(
      @sNro_Doc CHAR(20)
)
AS 
    BEGIN
		SELECT mov_num_c
			FROM saDevolucionCliente WHERE doc_num = @sNro_Doc
	END
```
