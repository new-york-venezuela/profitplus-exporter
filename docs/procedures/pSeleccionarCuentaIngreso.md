# SP: pSeleccionarCuentaIngreso
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saCuentaIngEgr`](../tables/saCuentaIngEgr.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarTablaCta_Ingr
DESCRIPCION: Selecciona los campos de la tabla cta_ingr
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/

CREATE PROCEDURE [pSeleccionarCuentaIngreso]
    (
      @sCo_Cta_Ingr_Egr CHAR(20)
    )
AS 
    BEGIN
        SELECT
            *
        FROM
            saCuentaIngEgr
        WHERE
            co_cta_ingr_egr = @sCo_Cta_Ingr_Egr
    END
```
