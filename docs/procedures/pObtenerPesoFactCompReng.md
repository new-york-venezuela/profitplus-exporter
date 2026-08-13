# SP: pObtenerPesoFactCompReng
**Tipo**: Obtener
**Módulo**: General

## Código (excerpt)
```sql
/*************************************************************************************************
NOMBRE:	pObtenerPesoFactCompReng
DESCRIPCION: Dado el rowguid de un renglón de factura de compra, devuelve el peso del renglón.
CREADO POR: SOFTECH SISTEMAS
CREADO EL: 19/11/2014
**************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerPesoFactCompReng]
    (
      @rFact_Comp_Reng UNIQUEIDENTIFIER
    )
AS 
    BEGIN
        SELECT dbo.CalcularPesoFactCompReng(@rFact_Comp_Reng)
    END
```
