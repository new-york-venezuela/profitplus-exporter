# SP: RepMonedaTasa
**Tipo**: Reporte
**Módulo**: General

## Tablas Referenciadas
- [`saMoneda`](../tables/saMoneda.md)
- [`saTasa`](../tables/saTasa.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <05-04-10>
-- Description:	<Reportes de Moneda con sus Tasas>
-- =============================================
CREATE PROCEDURE [RepMonedaTasa]
	-- Add the parameters for the stored procedure here
    @sCo_MonedaTasa_d CHAR(6) = NULL ,
    @sCo_MonedaTasa_h CHAR(6) = NULL ,
    @sCo_Fecha_d SMALLDATETIME = NULL ,
    @sCo_Fecha_h SMALLDATETIME = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        SELECT
            ISNULL(T.tasa_c, 1) AS tasa_c, ISNULL(T.tasa_v, 1) AS tasa_v, T.fecha, M.*
        FROM
            saMoneda M
            LEFT JOIN saTasa AS T ON T.co_mone = M.co_mone
        WHERE
            ( ( @sCo_MonedaTasa_d IS NULL
                OR M.co_mone >= @sCo_MonedaTasa_d
              )
              AND ( @sCo_MonedaTasa_h IS NULL
                    OR M.co_mone <= @sCo_MonedaTasa_h
                  )
            )
            AND ( ( @sCo_Fecha_d IS NULL
                    OR T.fecha >= @sCo_Fecha_d
                  )
                  AND ( @sCo_Fecha_h IS NULL
                        OR T.fecha <= @sCo_Fecha_h
                      )
                )
            AND ( @sCo_Sucursal IS NULL
                  OR M.co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'mone_des' THEN M.mone_des
                                 ELSE M.co_mone
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'mone_des' THEN M.mone_des
                                          ELSE M.co_mone
                                        END
                      END ASC
    END
```
