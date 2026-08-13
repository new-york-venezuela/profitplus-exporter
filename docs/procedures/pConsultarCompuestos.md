# SP: pConsultarCompuestos
**Tipo**: Consultar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtCompuesto`](../tables/saArtCompuesto.md)
- [`saArtCompuestoReng`](../tables/saArtCompuestoReng.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pConsultarCompuestos]
*DESCRIPCIÓN	: Calcula el stock para un determinado articulo
*AUTOR			: SOFTECH SISTEMAS
*FECHA			: 2009-09-14
*ACTUALIZACION	: 2010-01-15
**************************************************************************/

CREATE PROCEDURE [pConsultarCompuestos] ( @sCo_Art CHAR(30) )
AS 
    BEGIN	
        DECLARE @co_artc CHAR(20)

        SELECT
            @co_artc = co_artc
        FROM
            saArtCompuesto
        WHERE
            co_art = @sCo_Art
		
        IF ( @co_artc IS NULL ) 
            BEGIN
                SELECT
                    saArtCompuesto.co_artc AS Co_Art, saArtCompuesto.descrip AS Art_Des
                FROM
                    saArtCompuesto
                    INNER JOIN saArtCompuestoReng ON saArtCompuesto.co_artc = saArtCompuestoReng.co_artc
                WHERE
                    saArtCompuestoReng.co_art = @sCo_Art
            END
        ELSE 
            SELECT
                @co_artc AS ArtCompuesto
		
    END
```
