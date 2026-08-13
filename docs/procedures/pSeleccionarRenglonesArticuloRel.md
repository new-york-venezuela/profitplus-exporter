# SP: pSeleccionarRenglonesArticuloRel
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtRelacionadoReng`](../tables/saArtRelacionadoReng.md)
- [`saArticulo`](../tables/saArticulo.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarRenglonesArticuloRel
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
FECHA: 11/08/2009
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarRenglonesArticuloRel] ( @sCo_Art CHAR(30) )
AS 
    BEGIN
        SELECT
            R.*, A.Art_Des descripcion
        FROM
            saArtRelacionadoReng R
            INNER JOIN saArticulo A ON A.Co_Art = R.cod_relac
        WHERE
            R.co_art = @sCo_Art
        ORDER BY
            R.reng_num ASC
    END
```
