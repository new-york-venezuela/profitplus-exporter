# SP: pObtenerImpresionDigital
**Tipo**: Obtener
**Módulo**: General

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pObtenerImpresionDigital
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerImpresionDigital] ( @sCo_Impdig CHAR(6) )
AS 
    BEGIN	
    select *  FROM[saImpDigital] where co_impdig = @sCo_Impdig
    END
```
