# SP: pSeleccionarArticuloPorTipo
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarArticuloPorTipo
DESCRIPCION: Seleccionar todos los articulos de un tipo (Ej.: Los articulos de tipo servicio 'S')
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarArticuloPorTipo] ( @sTipo CHAR(1) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saArticulo
        WHERE
            tipo = @sTipo
    END
```
