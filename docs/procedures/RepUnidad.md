# SP: RepUnidad
**Tipo**: Reporte
**Módulo**: General

## Tablas Referenciadas
- [`saUnidad`](../tables/saUnidad.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <02-03-10>
-- Description:	<Listado de las Unidades>
-- =============================================
CREATE PROCEDURE [RepUnidad]
	-- Add the parameters for the stored procedure here
    @sCo_Uni_d CHAR(6) = NULL ,
    @sCo_Uni_h CHAR(6) = NULL ,
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
            saUnidad
        WHERE
            ( ( @sCo_Uni_d IS NULL
                OR @sCo_Uni_d <= co_uni
              )
              AND ( @sCo_Uni_h IS NULL
                    OR co_uni <= @sCo_uni_h
                  )
            )
            AND ( @sCo_Sucursal IS NULL
                  OR co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'des_uni' THEN des_uni
                                 ELSE co_uni
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'des_uni' THEN des_uni
                                          ELSE co_uni
                                        END
                      END ASC
    END
```
