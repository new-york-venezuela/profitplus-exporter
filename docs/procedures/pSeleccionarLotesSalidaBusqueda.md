# SP: pSeleccionarLotesSalidaBusqueda
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saLoteEntrada`](../tables/saLoteEntrada.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			[pSeleccionarLotesSalidaBusqueda]
DESCRIPCION:	Seleccionar Seriales de entrada
CREADO POR:		SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarLotesSalidaBusqueda]
    (
      @sCo_Art CHAR(30) = NULL,
      @sCo_Alma CHAR(6) = NULL 
    )
AS 
    BEGIN
        SELECT
            *
        FROM
            saLoteEntrada
        WHERE
            co_art = @sCo_Art
            AND ( co_alma = @sCo_Alma
                  OR @sCo_Alma IS NULL
                )
            AND ( stock_actual > 0)
        ORDER BY
            numero_lote
    END
```
