# SP: pActualizarDistribCostoRelaReng
**Tipo**: Actualizar
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
CREATE PROCEDURE [dbo].[pActualizarDistribCostoRelaReng]
    (
	  @sDistrib_Num_Destino		CHAR(20),
	  @iReng_Num_Destino		INT, 
	  @sDistrib_Num_Origen		CHAR(20),
	  @iReng_Num_Origen			INT, 
	  @sTipo_Dist				CHAR(1),
	  @deMonto					DECIMAL(18,5),
      @gRowguid					UNIQUEIDENTIFIER
	)
AS
BEGIN
	 
	UPDATE dbo.saDistribCostoRelaReng SET
	distrib_num_destino = @sDistrib_Num_Destino, 
	reng_num_destino = @iReng_Num_Destino, 
	distrib_num_origen = @sDistrib_Num_Origen, 
	reng_num_origen = @iReng_Num_Origen,
	 tipo_distrib = @sTipo_Dist, monto = @deMonto

	where Rowguid = @gRowguid
    END
```
