# SP: pSeleccionarAjustePrecioCostoManual
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjPrecioCostoM`](../tables/saAjPrecioCostoM.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			pSeleccionarAjustePrecioCostoManual
DESCRIPCION:	Procedimiento que obtiene el ajuste de precio y costo manual
CREADO POR:		SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarAjustePrecioCostoManual] ( @sCod_Ajuste CHAR(20) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saAjPrecioCostoM
        WHERE
            cod_ajuste = @sCod_Ajuste
		 
    END
```
