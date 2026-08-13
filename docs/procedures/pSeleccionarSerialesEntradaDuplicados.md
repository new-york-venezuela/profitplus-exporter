# SP: pSeleccionarSerialesEntradaDuplicados
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saSeriales`](../tables/saSeriales.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			[pSeleccionarSerialesDuplicados]
DESCRIPCION:	sp usado para verificar si un articulo se encuentra duplicado
CREADO POR:		SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarSerialesEntradaDuplicados]
    (
      @sCo_Art CHAR(30) ,
      @sCo_Alma CHAR(6) ,
      @sSerial CHAR(40) ,
      @gDoc_Num_E UNIQUEIDENTIFIER ,
      @gRowguid UNIQUEIDENTIFIER
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
            AND rowguid <> @gRowguid 
        ORDER BY
            reng_num
    END
```
