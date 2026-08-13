# SP: pObtenerVolumenFactCompReng
**Tipo**: Obtener
**Módulo**: General

## Código (excerpt)
```sql
/*************************************************************************************************
NOMBRE:	pObtenerVolumenFactCompReng
DESCRIPCION: Dado el rowguid de un renglón de factura de compra, devuelve el volumen del renglón.
CREADO POR: SOFTECH SISTEMAS
CREADO EL: 19/11/2014
**************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerVolumenFactCompReng]
    (
      @rFact_Comp_Reng UNIQUEIDENTIFIER
    )
AS
    BEGIN
        SELECT dbo.CalcularVolumenFactCompReng(@rFact_Comp_Reng)
    END
```
