# SP: pObtenerArticuloCostoPorAlmacen
**Tipo**: Obtener
**Módulo**: Inventario

## Tablas Referenciadas
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)
- [`saStockAlmacen`](../tables/saStockAlmacen.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pObtenerArticuloCostoPorAlmacen
DESCRIPCION: Busca el Tipo Costo, Costo, Almacen, Registro y Emision de la tabla 
			 CostoHistoricoEntrada junto con los campos Almacen y Cantidad en stoc de la
			 tabla saStockAlmacen, usando INNERJOIN
			 @sRowIdAlmacen representa el identificador del articulo en el grid.
			 @sAlmacen representa el almacen seleccionado en el IfCombo
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerArticuloCostoPorAlmacen] ( @sCo_Alma CHAR(6)

                                                           )
AS 
    BEGIN
        SELECT
            stockAl.co_alma, costoArt.costo, costoArt.cod_almacen, costoArt.fecha_registro, costoArt.fecha_emision
        FROM
            saStockAlmacen stockAl
            INNER JOIN saCostoHistoricoEntrada costoArt ON stockAl.co_alma = costoArt.cod_almacen
        WHERE
            costoArt.cod_articulo_rowguid = '00000000-0000-0000-0000-000000000000'
    END
```
