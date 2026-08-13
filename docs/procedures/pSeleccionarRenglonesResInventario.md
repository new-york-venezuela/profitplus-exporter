# SP: pSeleccionarRenglonesResInventario
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saResInventario`](../tables/saResInventario.md)
- [`saResInventarioReng`](../tables/saResInventarioReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarRenglonesResInventario
DESCRIPCION: Busca los renglones segun el código del padre asociado
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarRenglonesResInventario] ( @sNum_ResInv CHAR(20) )
AS 
    BEGIN
        SELECT
            R.*, A.art_des, E.tasa, A.rowguid AS rowguid_articulo
        FROM
            saResInventarioReng R
            INNER JOIN saArticulo A ON R.co_art = A.co_art
            INNER JOIN saResInventario E ON E.num_resinv = R.num_resinv
        WHERE
            R.num_resinv = @sNum_ResInv
        ORDER BY
            R.reng_num ASC
    END
```
