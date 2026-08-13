# SP: RepColor
**Tipo**: Reporte
**Módulo**: General

## Tablas Referenciadas
- [`saColor`](../tables/saColor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <01-03-10>
-- Description:	<Listado de Colores>
-- =============================================
CREATE PROCEDURE [RepColor]
	-- Add the parameters for the stored procedure here
    @sCo_Color_d CHAR(6) = NULL ,
    @sCo_Color_h CHAR(6) = NULL ,
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
            saColor
        WHERE
            ( ( @sCo_Color_d IS NULL
                OR @sCo_Color_d <= co_color
              )
              AND ( @sCo_Color_h IS NULL
                    OR co_color <= @sCo_Color_h
                  )
            )
            AND ( @sCo_Sucursal IS NULL
                  OR co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'des_color' THEN des_color
                                 ELSE co_color
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'des_color' THEN des_color
                                          ELSE co_color
                                        END
                      END ASC
    END
```
