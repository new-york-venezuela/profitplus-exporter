# SP: pSeleccionarUbicacion
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saUbicacion`](../tables/saUbicacion.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarUbicacion
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarUbicacion] ( @sCo_Ubicacion CHAR(6) )
AS 
    BEGIN
        SELECT
            [co_ubicacion], [des_ubicacion], [campo1], [campo2], [campo3], [campo4], [campo5], [campo6], [campo7],
            [campo8], [co_us_in], [co_sucu_in], [fe_us_in], [co_us_mo], [co_sucu_mo], [fe_us_mo], [revisado], [trasnfe],
            [validador], [rowguid]
        FROM
            [saUbicacion]
        WHERE
            co_ubicacion = @sCo_Ubicacion
    END
```
