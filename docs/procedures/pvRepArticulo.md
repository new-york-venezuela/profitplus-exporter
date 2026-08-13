# SP: pvRepArticulo
**Tipo**: Punto de Venta
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtCaracteristica`](../tables/saArtCaracteristica.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saLineaArticulo`](../tables/saLineaArticulo.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pvRepArticulo
*DESCRIPCIÓN	: Reporte de Articulo con sus Comentarios
*AUTOR			: SOFTECH SISTEMAS
***************************************************************************/ 
CREATE PROCEDURE [dbo].[pvRepArticulo] 
-- Add the parameters for the stored procedure here
    @sCo_Art_d	char(30)	  = NULL,
    @sCo_Art_h	char(30)	  = NULL,
    @sArt_Des char(120)     = NULL,    
    @bActivo BIT =0,
	@sCampOrderBy VARCHAR(16) = NULL,
    @sDir VARCHAR(6)          = NULL,
    @bHeaderRep BIT = 0   			
AS 
    BEGIN
    SELECT
          ac.co_art, a.art_des,  
          ac.co_lin01, la1.lin_des as des_co_lin01,
          ac.co_lin02, la2.lin_des as des_co_lin02,
          ac.co_lin03, la3.lin_des as des_co_lin03,
          ac.co_lin04, la4.lin_des as des_co_lin04, 
          ac.co_lin05, la5.lin_des as des_co_lin05
   
    FROM
       saArtCaracteristica ac 
        INNER JOIN saArticulo a       ON ac.co_art  = a.co_art
        left JOIN saLineaArticulo la1 ON la1.co_lin = ac.co_lin01 
        left JOIN saLineaArticulo la2 ON la2.co_lin = ac.co_lin02 
        left JOIN saLineaArticulo la3 ON la3.co_lin = ac.co_lin03 
        left JOIN saLineaArticulo la4 ON la4.co_lin = ac.co_lin04
        left JOIN saLineaArticulo la5 ON la5.co_lin = ac.co_lin05
    WHERE
        (@sCo_Art_d IS NULL OR @sCo_Art_d <= ac.co_art)
	AND (@sCo_Art_h IS NULL OR ac.co_art  <= @sCo_Art_h)
            
ORDER BY
            CASE @sDir
				 WHEN 'DESC' THEN 
					CASE @sCampOrderBy
                         WHEN 'art_des' THEN a.art_des
                         ELSE ac.co_art
                    END
				  END DESC, 
			CASE @sDir
                 WHEN 'ASC' THEN 
					CASE @sCampOrderBy
                         WHEN 'art_des' THEN a.art_des
                         ELSE ac.co_art
                    END
             END ASC
 END
```
