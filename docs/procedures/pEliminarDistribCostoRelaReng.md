# SP: pEliminarDistribCostoRelaReng
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saDistribCostoRelaReng`](../tables/saDistribCostoRelaReng.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pInsertarDistribCostoRelaReng
*DESCRIPCIÓN	:	INSERTA LA RELACION ENTRE EL ORIGEN Y EL DESTINO DE UNA DISTRIBUCION DE COSTO
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/
CREATE PROCEDURE [dbo].[pEliminarDistribCostoRelaReng]
    (
      @gRowguid					UNIQUEIDENTIFIER
	)
AS
BEGIN
	 
	DELETE FROM dbo.saDistribCostoRelaReng 
	where Rowguid = @gRowguid
    END
```
