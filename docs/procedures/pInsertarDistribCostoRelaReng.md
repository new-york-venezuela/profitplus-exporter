# SP: pInsertarDistribCostoRelaReng
**Tipo**: Insertar
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
CREATE PROCEDURE [dbo].[pInsertarDistribCostoRelaReng]
    (
	  @sDistrib_Num_Destino		CHAR(20),
	  @iReng_Num_Destino		INT, 
	  @sDistrib_Num_Origen		CHAR(20),
	  @iReng_Num_Origen			INT, 
	  @sTipo_Dist				CHAR(1),
	  @deMonto					DECIMAL(18,2)
	)
AS
BEGIN
	 
	INSERT INTO dbo.saDistribCostoRelaReng
			   (distrib_num_destino, reng_num_destino, distrib_num_origen, reng_num_origen, tipo_distrib, monto)
	VALUES
			   (@sDistrib_Num_Destino, @iReng_Num_Destino, @sDistrib_Num_Origen, @iReng_Num_Origen, @sTipo_Dist, @deMonto)
    END
```
