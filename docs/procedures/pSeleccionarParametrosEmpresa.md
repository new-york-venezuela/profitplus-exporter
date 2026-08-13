# SP: pSeleccionarParametrosEmpresa
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarParametrosEmpresa
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarParametrosEmpresa] ( @sCod_Emp VARCHAR(20) )
AS 
    BEGIN
        SELECT
            *
        FROM
            par_emp
        WHERE
            cod_emp = @sCod_Emp
    END
```
