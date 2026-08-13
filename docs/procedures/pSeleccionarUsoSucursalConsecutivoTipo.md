# SP: pSeleccionarUsoSucursalConsecutivoTipo
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saConsecutivoTipo`](../tables/saConsecutivoTipo.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			[pSeleccionarUsoSucursalConsecutivoTipo]
DESCRIPCION:	Consulta a la tabla saConsecutivoTipo para consultar si el
				campo UsoSucursal se encuentra encendido
CREADO POR:		SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarUsoSucursalConsecutivoTipo]
    @sCo_Consecutivo CHAR(16)
AS 
    BEGIN
        SELECT
            UsoSucursal, ( SELECT
                            v_maneja_sucursales
                           FROM
                            par_emp
                         ) AS maneja_sucursal
        FROM
            saConsecutivoTipo
        WHERE
            co_consecutivo = @sCo_Consecutivo

    END
```
