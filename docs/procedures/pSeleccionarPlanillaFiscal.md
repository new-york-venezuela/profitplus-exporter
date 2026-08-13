# SP: pSeleccionarPlanillaFiscal
**Tipo**: Seleccionar
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saPlanillaFiscal`](../tables/saPlanillaFiscal.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarPlanillaFiscal
DESCRIPCION: Selecciona de saPlanillaFiscal
CREADO POR:  SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarPlanillaFiscal] ( @sCod_Plan CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saPlanillaFiscal
        WHERE
            cod_plan = @sCod_Plan
    END
```
