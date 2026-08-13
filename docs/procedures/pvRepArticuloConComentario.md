# SP: pvRepArticuloConComentario
**Tipo**: Punto de Venta
**Módulo**: Inventario

## Tablas Referenciadas
- [`pvArticuloExt`](../tables/pvArticuloExt.md)
- [`saArticulo`](../tables/saArticulo.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pvRepArticuloConComentario
*DESCRIPCIÓN	: Reporte de Articulo con su descripcion
*AUTOR			: SOFTECH SISTEMAS
***************************************************************************/ 
CREATE PROCEDURE [dbo].[pvRepArticuloConComentario] 
    @sCo_Art_d	char(30)	  = NULL,
    @sCo_Art_h	char(30)	  = NULL,
    @sArt_Des char(120)     = NULL,    
    @bActivo BIT = 0,
	@sCampOrderBy VARCHAR(16) = NULL,
    @sDir VARCHAR(6)          = NULL,
    @bHeaderRep BIT = 0
AS 
    BEGIN
       SELECT     
		   a.co_art, a.art_des, 
		   (case when arex.DescripRenglon   = '1' then 'Si' else 'No' end) as DescripRenglon,
		   (case when arex.CampoObligatorio = '1' then 'Si' else 'No' end) as CampoObligatorio, 
		   arex.DescripRenglonTxt
		FROM         
			saArticulo as a INNER JOIN
            pvArticuloExt as arex ON a.rowguid = arex.Id
        WHERE
                (@sCo_Art_d IS NULL OR @sCo_Art_d <=  a.co_art)
			AND (@sCo_Art_h IS NULL OR a.co_art   <= @sCo_Art_h)
        ORDER BY
			CASE @sDir
				 WHEN 'DESC' THEN 
					CASE @sCampOrderBy
                         WHEN 'art_des' THEN a.art_des
                         ELSE a.co_art
                    END
				  END DESC, 
			CASE @sDir
                 WHEN 'ASC' THEN 
					CASE @sCampOrderBy
                         WHEN 'art_des' THEN a.art_des
                         ELSE a.co_art
                    END
             END ASC
 END
```
