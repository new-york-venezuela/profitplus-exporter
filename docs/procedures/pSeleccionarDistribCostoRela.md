# SP: pSeleccionarDistribCostoRela
**Tipo**: Seleccionar
**Módulo**: General

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarDistribCostoRela
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarDistribCostoRela] ( @sDistrib_Num CHAR(20) )
AS 
    BEGIN
        SELECT
            @sDistrib_Num AS Distrib_Num
    END
```
