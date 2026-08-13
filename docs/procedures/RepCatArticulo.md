# SP: RepCatArticulo
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saCatArticulo`](../tables/saCatArticulo.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <04-03-10>
-- Description:	<Categoria de los articulos>
-- =============================================
CREATE PROCEDURE [RepCatArticulo]
	-- Add the parameters for the stored procedure here
    @sCo_Cat_d CHAR(6) = NULL ,
    @sCo_Cat_h CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        SELECT
            *
        FROM
            saCatArticulo
        WHERE
            ( ( @sCo_Cat_d IS NULL
                OR co_cat >= @sCo_Cat_d
              )
              AND ( @sCo_Cat_h IS NULL
                    OR co_cat <= @sCo_Cat_h
                  )
            )
            AND ( @sCo_Sucursal IS NULL
                  OR co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'cat_des' THEN cat_des
                                 ELSE co_cat
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'cat_des' THEN cat_des
                                          ELSE co_cat
                                        END
                      END ASC
    END
```
