# SP: pSeleccionarLogoEmpresa
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarLogoEmpresa
DESCRIPCION:  Seleccional el logo de la empresa en la tabla de parametros
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarLogoEmpresa]
AS 
    BEGIN
        SELECT
            logo
        FROM
            par_emp
    END
```
