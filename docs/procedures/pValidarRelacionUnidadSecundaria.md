# SP: pValidarRelacionUnidadSecundaria
**Tipo**: Validar
**Módulo**: General

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)

## Código (excerpt)
```sql
/******************************************************************************************
*AUTOR:			Softech Sistemas
*FECHA:			14/07/2010
*DESCRIPCION:	Valida si existe unidades secundarias asociadas a un articulo
*******************************************************************************************/

CREATE PROCEDURE [pValidarRelacionUnidadSecundaria] ( @sCo_Art CHAR(30) )
AS 
    BEGIN

        SELECT
            CAST(ISNULL(COUNT(co_art), 0) AS BIT) existe
        FROM
            saArtUnidad
        WHERE
            co_art = @sCo_Art
            AND uni_secundaria = 1

    END
```
