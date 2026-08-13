# SP: pObtenerExistenciaConAlmacenes
**Tipo**: Obtener
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAlmacen`](../tables/saAlmacen.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pObtenerExistenciaConAlmacenes]
/******************************************************************************
* Stored Procedure : Obtiene la existencia del producto -               *
* Fecha Creación   :  03/10/2012                                            *
******************************************************************************/
(		
		@sCoArticulo	CHAR(30)
)
AS
BEGIN


	SELECT co_alma, des_alma, [dbo].[ConsultarStockActualxAlmacen] (
   @sCoArticulo, co_alma) as primaria
   
	from saAlmacen

END
```
