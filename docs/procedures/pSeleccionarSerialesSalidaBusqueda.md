# SP: pSeleccionarSerialesSalidaBusqueda
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
CREATE PROCEDURE [pSeleccionarSerialesSalidaBusqueda]
    (
      @sCo_Art CHAR(30) ,
      @sCo_Alma CHAR(6) = NULL ,
      @sDesde CHAR(40) = NULL ,
      @sHasta CHAR(40) = NULL
		--@sTipo_Doc	char(4)
	
    )
AS 
    BEGIN
        SELECT
            *
        FROM
            saSeriales
        WHERE
            co_art = @sCo_Art
            AND ( co_alma = @sCo_Alma
                  OR @sCo_Alma IS NULL
                )
            AND ( @sDesde IS NULL
                  OR serial >= @sDesde
                )
            AND ( @sHasta IS NULL
                  OR serial <= @sHasta
                )
            AND ( doc_num_s IS NULL )
        ORDER BY
            serial
    END
```
