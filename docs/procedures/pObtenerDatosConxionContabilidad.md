# SP: pObtenerDatosConxionContabilidad
**Tipo**: Obtener
**Módulo**: General

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pObtenerDatosConxionContabilidad
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerDatosConxionContabilidad] ( @sCod_Emp CHAR(20) )
AS 
    BEGIN
        SELECT
            urlservidorweb_cont, co_cue_aju, emp_cont, login_cont, password_cont
        FROM
            par_emp
        WHERE
            cod_emp = @sCod_Emp
    END
```
