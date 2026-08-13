# SP: pSeleccionarImpuestoSobreVenta
**Tipo**: Seleccionar
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saImpuestoSobreVenta`](../tables/saImpuestoSobreVenta.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarImpuestoSobreVenta
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
MODIFICADO: SOFTECH SISTEMAS 
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarImpuestoSobreVenta]
    (
      @sdFecha SMALLDATETIME
	
    )
AS 
    BEGIN

        SELECT
            *, ( SELECT
                    CASE WHEN DATEDIFF(DAY, MAX(fecha), @sdFecha) = 0 THEN 1
                         ELSE 0
                    END
                 FROM
                    saImpuestoSobreVenta
               ) AS isUltimaFecha
        FROM
            saImpuestoSobreVenta
        WHERE
            fecha = @sdFecha
    END
```
