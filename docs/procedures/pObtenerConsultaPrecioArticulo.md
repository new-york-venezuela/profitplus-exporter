# SP: pObtenerConsultaPrecioArticulo
**Tipo**: Obtener
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
CREATE PROCEDURE [dbo].[pObtenerConsultaPrecioArticulo]
    (
		@sTipoPrecio_D VARCHAR(6) = null,
        @sTipoPrecio_H VARCHAR (6) = null,
        @sCo_Articulo_D VARCHAR (30) = null,
        @sCo_Articulo_H VARCHAR (30) = null,
        @sCo_Alma_D VARCHAR (6) = null,
        @sCo_Alma_H VARCHAR (6) = null,
        @sCo_Mone_D VARCHAR (6) = null,
        @sCo_Mone_H VARCHAR (6) = null,
        @nFecha_ini_D DateTime = null, 
        @nFecha_ini_H DateTime = null,
        @nFecha_Fin_D DateTime = null,
        @nFecha_Fin_H DateTime = null,
        @iInactivo int
	
    )
AS 
    BEGIN
        SELECT TOP (50)
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
```
