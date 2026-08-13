# SP: pSeleccionarImpuesto
**Tipo**: Seleccionar
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saImpuesto`](../tables/saImpuesto.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarImpuesto
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarImpuesto] ( @sCod_Impuesto CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saImpuesto
        WHERE
            cod_impuesto = @sCod_Impuesto
    END
```
