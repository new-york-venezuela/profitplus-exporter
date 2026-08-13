# SP: RepPais
**Tipo**: Reporte
**Módulo**: General

## Tablas Referenciadas
- [`saPais`](../tables/saPais.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <04-03-10>
-- Description:	<Reportes de Paises>
-- =============================================
CREATE PROCEDURE [RepPais]
	-- Add the parameters for the stored procedure here
    @sCo_Pais_d CHAR(6) = NULL ,
    @sCo_Pais_h CHAR(6) = NULL ,
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
            saPais
        WHERE
            ( ( @sCo_Pais_d IS NULL
                OR co_pais >= @sCo_Pais_d
              )
              AND ( @sCo_Pais_h IS NULL
                    OR co_pais <= @sCo_Pais_h
                  )
            )
            AND ( @sCo_Sucursal IS NULL
                  OR co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'pais_des' THEN pais_des
                                 ELSE co_pais
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'pais_des' THEN pais_des
                                          ELSE co_pais
                                        END
                      END ASC
    END
```
