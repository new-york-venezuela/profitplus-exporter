# SP: pSeleccionarArticuloRelacionado
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtRelacionadoReng`](../tables/saArtRelacionadoReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarArticuloRelacionado
DESCRIPCION: Selecciona los registros de la tabla  saArtRelacionadoReng
CREADO POR: SOFTECH SISTEMAS
FECHA: 11/08/2009
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarArticuloRelacionado]
    (
      @sCo_Art CHAR(30) ,
      @iReng_Num INT
	
    )
AS 
    BEGIN
        SELECT
            *
        FROM
            saArtRelacionadoReng
        WHERE
            co_art = @sCo_Art
            AND reng_num = @iReng_Num
    END
```
