# SP: pSeleccionarRenglonesArtIdentificador
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtIdentificadorReng`](../tables/saArtIdentificadorReng.md)
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saUnidad`](../tables/saUnidad.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			pSeleccionarRenglonesIdentificador
DESCRIPCION: 
CREADO POR:		SOFTECH SISTEMAS
FECHA:			18/09/2009
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarRenglonesArtIdentificador] ( @sCo_Art CHAR(30) )
AS 
    BEGIN
        SELECT
            C.des_uni, A.*
        FROM
            ( saArtIdentificadorReng A
              INNER JOIN saArtUnidad B ON A.co_uni = B.co_uni
                                          AND A.co_art = B.co_art
            )
            INNER JOIN saUnidad C ON B.co_uni = C.co_uni
        WHERE
            A.co_art = @sCo_Art
        ORDER BY
            reng_num ASC
    END
```
