# SP: pSeleccionarSerialesEntradaExistencia
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saSeriales`](../tables/saSeriales.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			[pSeleccionarSerialesDuplicados]
DESCRIPCION:	sp usado para verificar si un articulo se encuentra duplicado
CREADO POR:		Softech
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarSerialesEntradaExistencia]
    (
      @sCo_Art CHAR(30) ,
      @sCo_Alma CHAR(6) ,
      @sSerial CHAR(40)
    )
AS 
    BEGIN
        SELECT
            *
        FROM
            saSeriales
        WHERE
            serial = @sSerial
            AND doc_num_s IS NULL
            AND co_art = @sCo_Art
            AND co_alma = @sCo_Alma -- Probablemente no hace falta, se encuentra validado en el UIPC
        ORDER BY
            reng_num
    END
```
