# SP: pSeleccionarValorImpuestoRenglon
**Tipo**: Seleccionar
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saImpuestoReng`](../tables/saImpuestoReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarValorImpuestoRenglon
DESCRIPCION: Seleccionar los valores del Impuesto
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarValorImpuestoRenglon] ( @sCod_Impuesto CHAR(6) )
AS 
    BEGIN 

        SELECT
            ir.*
        FROM
            saImpuestoReng AS ir
        WHERE
            cod_impuesto = @sCod_Impuesto
        ORDER BY
            ir.fecha_regis ASC

    END
```
