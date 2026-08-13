# SP: pSeleccionarSubLinea
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saSubLinea`](../tables/saSubLinea.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarSubLinea
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarSubLinea]
    (
      @sCo_Subl CHAR(6) ,
      @sCo_Lin CHAR(6)
    )
AS 
    BEGIN

        SELECT
            *
        FROM
            saSubLinea
        WHERE
            co_subl = @sCo_Subl
            AND co_lin = @sCo_Lin

    END
```
