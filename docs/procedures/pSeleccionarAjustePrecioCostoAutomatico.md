# SP: pSeleccionarAjustePrecioCostoAutomatico
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjPrecioCostoAuto`](../tables/saAjPrecioCostoAuto.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			[pSeleccionarAjustePrecioCostoAutomatico]
DESCRIPCION:	Procedimiento que obtiene el ajuste de precio y costo automatico
CREADO POR:		SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarAjustePrecioCostoAutomatico] ( @sCod_Ajuste CHAR(20) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saAjPrecioCostoAuto
        WHERE
            cod_ajuste = @sCod_Ajuste
		 
    END
```
