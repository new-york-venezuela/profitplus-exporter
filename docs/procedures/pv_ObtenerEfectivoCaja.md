# SP: pv_ObtenerEfectivoCaja
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`saSaldoCaja`](../tables/saSaldoCaja.md)

## Código (excerpt)
```sql
/**********************************************************************
*NOMBRE:            [pObtenerEfectivoCaja]
*DESCRIPCIÓN: Obtiene el saldo en Efectivo de una caja dada.
*AUTOR:                    SOFTECH SISTEMAS
***********************************************************************/

CREATE PROCEDURE [dbo].[pv_ObtenerEfectivoCaja]
    (
      @sCodCaja CHAR(6) 
    )
AS 
    SET NOCOUNT ON 
             BEGIN        
                    SELECT saldo FROM saSaldoCaja
                    WHERE
                           cod_caja =@sCodCaja AND
                           tipo = 'EF'
             END
    SET NOCOUNT OFF
```
