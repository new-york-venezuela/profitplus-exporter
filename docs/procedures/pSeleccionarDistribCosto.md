# SP: pSeleccionarDistribCosto
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saDistribCosto`](../tables/saDistribCosto.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			pSeleccionarDistribCosto
DESCRIPCION:	Selecciona el encabezado de una distribucion de costo
CREADO POR:		SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarDistribCosto] 
(
	@sDistrib_Num CHAR(20) 
)
AS 
    BEGIN
        SELECT
          *
        FROM
           saDistribCosto 
        WHERE
            distrib_num = @sDistrib_Num
    END
```
