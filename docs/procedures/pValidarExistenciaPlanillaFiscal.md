# SP: pValidarExistenciaPlanillaFiscal
**Tipo**: Validar
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saPlanillaFiscal`](../tables/saPlanillaFiscal.md)

## Código (excerpt)
```sql
/************************************************************************************************
*NOMBRE			: [pValidarExistenciaPlanillaFiscal]
*DESCRIPCIÓN	: Validar existencia de una planilla fiscal pagada para un determinado mes y año
*AUTOR			: SOFTECH SISTEMAS
*FECHA			: 2010-02-23
*MODIFICADO POR : SOFTECH SISTEMAS
*MODIFICADO EL  : 2010-08-25
*************************************************************************************************/

CREATE PROCEDURE [pValidarExistenciaPlanillaFiscal] ( @iAnho INT, @iMes INT )
AS 
    BEGIN	
        DECLARE @bExiste BIT


        SET @bExiste = 0

        IF EXISTS ( SELECT TOP ( 1 )
                        cod_plan
                    FROM
                        saPlanillaFiscal
                    WHERE
                        ano >= @iAnho
                        AND mes >= @iMes ) 
            SET @bExiste = 1
    
        SELECT
            @bExiste AS result

    END
```
