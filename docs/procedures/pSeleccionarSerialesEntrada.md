# SP: pSeleccionarSerialesEntrada
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saSeriales`](../tables/saSeriales.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			[pSeleccionarSerialesEntrada]
DESCRIPCION:	Seleccionar Seriales de entrada
CREADO POR:		SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarSerialesEntrada]
    (
      @gNum_Doc UNIQUEIDENTIFIER ,
      @sTipo_Doc CHAR(4)
    )
AS 
    BEGIN
        SELECT
            *
        FROM
            saSeriales
        WHERE
            doc_tip_e = @sTipo_Doc
            AND doc_num_e = @gNum_Doc
        ORDER BY
            serial
    END
```
