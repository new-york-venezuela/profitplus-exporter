# SP: pValidarManejaSerial
**Tipo**: Validar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pValidarManejaSerial]
*DESCRIPCIÓN	: Vealidar si un algún articulo del traslado maneja serial
*AUTOR			: SOFTECH SISTEMAS
*FECHA			: 19/05/2010
**************************************************************************/

CREATE PROCEDURE [pValidarManejaSerial] ( @sNumero CHAR(20) )
AS 
    BEGIN	
        DECLARE @bRetorno INT
	
        IF EXISTS ( SELECT
                        TR.co_art
                    FROM
                        saTrasladoReng AS TR
                        INNER JOIN saArticulo AS A ON TR.co_art = A.co_art
                    WHERE
                        TR.tras_num = @sNumero
                        AND A.maneja_serial = 1 ) --SI ALGUNO DE LOS ARTICULOS MANEJA SERIAL
            BEGIN
                SET @bRetorno = 1 
                SELECT
                    @bRetorno AS rango
            END
    END
```
