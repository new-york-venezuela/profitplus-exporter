# SP: pSeleccionarConsecutivoSucursal
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saSucursal`](../tables/saSucursal.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarSucursal
DESCRIPCION: Seleccion de un registro de la tabla  almacen
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarConsecutivoSucursal]
    (
      @sCodigo CHAR(20) ,
      @bEsParEmp BIT
	
    )
AS 
    BEGIN

        IF ( @bEsParEmp = 0 ) 
            BEGIN
                SELECT
                    co_sucur AS Codigo, sucur_des, @bEsParEmp AS EsParEmp, validador
                FROM
                    saSucursal
                WHERE
                    co_sucur = @sCodigo
            END
        ELSE 
            BEGIN
                SELECT
                    cod_emp AS Codigo, @bEsParEmp AS EsParEmp, validador
                FROM
                    par_emp
                WHERE
                    cod_emp = @sCodigo
            END


    END
```
