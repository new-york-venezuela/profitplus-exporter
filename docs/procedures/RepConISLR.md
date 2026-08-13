# SP: RepConISLR
**Tipo**: Reporte
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saConISLR`](../tables/saConISLR.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <02-03-10>
-- Description:	<Listado del I.S.R.L>
-- =============================================
CREATE PROCEDURE [RepConISLR]
	-- Add the parameters for the stored procedure here
    @sCo_ISLR_d CHAR(6) = NULL ,
    @sCo_ISLR_h CHAR(6) = NULL ,
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
            saConISLR
        WHERE
            ( ( @sCo_ISlR_d IS NULL
                OR @sCo_ISlR_d <= co_islr
              )
              AND ( @sCo_ISLR_h IS NULL
                    OR co_islr <= @sCo_ISLR_h
                  )
            )
            AND ( @sCo_Sucursal IS NULL
                  OR co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'islr_des' THEN islr_des
                                 ELSE co_islr
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'islr_des' THEN islr_des
                                          ELSE co_islr
                                        END
                      END ASC
    END
```
