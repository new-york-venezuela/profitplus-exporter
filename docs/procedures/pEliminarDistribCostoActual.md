# SP: pEliminarDistribCostoActual
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saDistribCostoRelaReng`](../tables/saDistribCostoRelaReng.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pEliminarDistribCostoActual
*DESCRIPCIÓN	:	Dado un número de distribución, elimina todas las relaciones asociadas.
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/
CREATE PROCEDURE [dbo].[pEliminarDistribCostoActual]
    (
	  @sDistrib_Num		CHAR(20)
	)
AS
BEGIN
	DELETE
		saDistribCostoRelaReng
	WHERE
		distrib_num_destino = @sDistrib_Num
END
```
