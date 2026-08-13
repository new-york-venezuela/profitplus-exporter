# SP: pvpSeleccionarRenglonDenominaciones
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvValeAlimentacionReng`](../tables/pvValeAlimentacionReng.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pvpSeleccionarRenglonDenominaciones
*DESCRIPCIÓN	: Selecciona todas las tasas asociados a una moneda
*AUTOR			: SOFTECH SISTEMAS
***************************************************************************/ 

CREATE PROCEDURE [dbo].[pvpSeleccionarRenglonDenominaciones] ( @sCo_Vale CHAR(6) )
AS 
    BEGIN

       SELECT 
		   [co_vale],[valor],[inactivo], [campo1],[campo2],[campo3],[campo4],[campo5],[campo6],
		   [campo7],[campo8],[co_us_in],[co_sucu_in],[fe_us_in],[co_us_mo],[co_sucu_mo],[fe_us_mo],
		   [revisado],[trasnfe],[validador],[rowguid], [reng_num]
        FROM
            pvValeAlimentacionReng
        WHERE
            Co_Vale = @sCo_Vale
        ORDER BY
            RENG_NUM ASC
	
    END
```
