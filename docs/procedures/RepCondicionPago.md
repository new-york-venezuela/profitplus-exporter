# SP: RepCondicionPago
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCondicionPago`](../tables/saCondicionPago.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <04-03-10>
-- Description:	<Condiciones de pago>
-- =============================================
CREATE PROCEDURE [RepCondicionPago]
	-- Add the parameters for the stored procedure here
    @sCo_ConPago_d CHAR(6) = NULL ,
    @sCo_ConPago_h CHAR(6) = NULL ,
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
            saCondicionPago
        WHERE
            ( ( @sCo_ConPago_d IS NULL
                OR co_cond >= @sCo_ConPago_d
              )
              AND ( @sCo_ConPago_h IS NULL
                    OR co_cond <= @sCo_ConPago_h
                  )
            )
            AND ( @sCo_Sucursal IS NULL
                  OR co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'cond_des' THEN cond_des
                                 ELSE co_cond
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'cond_des' THEN cond_des
                                          ELSE co_cond
                                        END
                      END ASC
    END
```
