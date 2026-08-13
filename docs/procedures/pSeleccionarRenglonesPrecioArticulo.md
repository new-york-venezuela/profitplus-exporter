# SP: pSeleccionarRenglonesPrecioArticulo
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtMargen`](../tables/saArtMargen.md)
- [`saArtPrecio`](../tables/saArtPrecio.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarRenglonesPrecioArticulo
DESCRIPCION: Selecciona los precios de un articulo de acuerdo a su codigo
CREADO POR: SOFTECH SISTEMAS
Actualizado por: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarRenglonesPrecioArticulo]
    (
      @sco_art CHAR(30) ,
      @pco_alma CHAR(6) = NULL
	
    )
AS 
    BEGIN
        SELECT
            ISNULL(( SELECT
                        monto_min
                     FROM
                        saArtMargen ma
                     WHERE
                        ma.co_art = rp.co_art
                        AND ma.co_precio = rp.co_precio
                   ), 0) monto_min, ISNULL(( SELECT
                                                monto_max
                                             FROM
                                                saArtMargen ma
                                             WHERE
                                                ma.co_art = rp.co_art
                                                AND ma.co_precio = rp.co_precio
                                           ), 0) monto_max, ISNULL(( SELECT TOP ( 1 )
                                                                        costo
                                                                     FROM
                                                                        saCostoHistoricoEntrada
                                                                     WHERE
                                                                        cod_articulo_rowguid = ( SELECT
                                                                                                    rowguid
                                                                                                 FROM
                                                                                                    saArticulo
                                                                                                 WHERE
                                                                                                    co_art = @sco_art
                                                                                               )
```
