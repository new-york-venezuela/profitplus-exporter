# SP: pvpSeleccionarConfigPuntoV
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvConfigPuntoV`](../tables/pvConfigPuntoV.md)

## Código (excerpt)
```sql
/*********************************************************************************************
*NOMBRE			: pvpSeleccionarConfigPuntoV
*DESCRIPCIÓN	: Selecciona una configuración segun el codigo de config pasado por parametro
*AUTOR			: SOFTECH SISTEMAS
**********************************************************************************************/ 

CREATE PROCEDURE [dbo].[pvpSeleccionarConfigPuntoV] 
	( 
	@sCo_Config CHAR(6) 
	)
AS 
    BEGIN
        SELECT
            *
        FROM
            pvConfigPuntoV
        WHERE
            co_config = @sCo_Config
    END
```
