# SP: RepLineaArticulo
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saLineaArticulo`](../tables/saLineaArticulo.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <04-03-10>
-- Description:	<Linea de los articulos>
-- =============================================
CREATE PROCEDURE [RepLineaArticulo]
	-- Add the parameters for the stored procedure here
    @sCo_Lin_d CHAR(6) = NULL ,
    @sCo_Lin_h CHAR(6) = NULL ,
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
            saLineaArticulo
        WHERE
            ( ( @sCo_Lin_d IS NULL
                OR co_lin >= @sCo_Lin_d
              )
              AND ( @sCo_Lin_h IS NULL
                    OR co_lin <= @sCo_Lin_h
                  )
            )
            AND ( @sCo_Sucursal IS NULL
                  OR co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'lin_des' THEN lin_des
                                 ELSE co_lin
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'lin_des' THEN lin_des
                                          ELSE co_lin
                                        END
                      END ASC
    END
```
