# SP: RepMoneda
**Tipo**: Reporte
**Módulo**: General

## Tablas Referenciadas
- [`saMoneda`](../tables/saMoneda.md)
- [`saTasa`](../tables/saTasa.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <04-03-10>
-- Description:	<Reportes de Moneda>
-- =============================================
CREATE PROCEDURE [RepMoneda]
	-- Add the parameters for the stored procedure here
    @sCo_Moneda_d CHAR(6) = NULL ,
    @sCo_Moneda_h CHAR(6) = NULL ,
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
                                     AND T.fecha = ( SELECT
                                                        MAX(fecha)
                                                     FROM
                                                        saTasa T2
                                                     WHERE
                                                        t.co_mone = t2.co_mone
                                                   )
        WHERE
            ( ( @sCo_Moneda_d IS NULL
                OR M.co_mone >= @sCo_Moneda_d
              )
              AND ( @sCo_Moneda_h IS NULL
                    OR M.co_mone <= @sCo_Moneda_h
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
