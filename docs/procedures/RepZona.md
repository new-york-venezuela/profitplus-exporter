# SP: RepZona
**Tipo**: Reporte
**Módulo**: General

## Tablas Referenciadas
- [`saZona`](../tables/saZona.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <17-03-09>
-- Description:	<Listado de las Zonas>
-- =============================================
CREATE PROCEDURE [RepZona]
	-- Add the parameters for the stored procedure here
    @sCo_Zon_d CHAR(6) = NULL ,
    @sCo_Zon_h CHAR(6) = NULL ,
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
            saZona
        WHERE
            ( ( @sCo_Zon_d IS NULL
                OR @sCo_Zon_d <= co_Zon
              )
              AND ( @sCo_Zon_h IS NULL
                    OR co_Zon <= @sCo_Zon_h
                  )
            )
            AND ( @sCo_Sucursal IS NULL
                  OR co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'Zon_des' THEN Zon_des
                                 ELSE co_Zon
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'Zon_des' THEN Zon_des
                                          ELSE co_Zon
                                        END
                      END ASC
    END
```
