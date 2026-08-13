# SP: pSeleccionarRenglonImpCtaBcaria
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saImpuestoCuentaBancaria`](../tables/saImpuestoCuentaBancaria.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		:	pSeleccionarRenglonImpCtaBcaria
DESCRIPCION	:	Procedimiento para seleccionar todos los tasas asociados a una moneda
CREADO POR	:	SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarRenglonImpCtaBcaria] ( @stipo_imp CHAR(3), @sCod_cta CHAR(6) )
AS 
    BEGIN

        SELECT
            *, 0 AS RENG_NUM
        FROM
            saImpuestoCuentaBancaria
        WHERE
		     tipo_imp = @stipo_imp
         AND cod_cta = @sCod_cta
        ORDER BY
            fecha_regis DESC
	
    END
```
