# SP: RepSucursal
**Tipo**: Reporte
**Módulo**: General

## Tablas Referenciadas
- [`saSucursal`](../tables/saSucursal.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <10-03-10>
-- Description:	<Reportes de Sucursales>
-- =============================================
CREATE PROCEDURE [RepSucursal]
	-- Add the parameters for the stored procedure here
    @sCo_Sucur_d CHAR(6) = NULL ,
    @sCo_Sucur_h CHAR(6) = NULL ,
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
            saSucursal
        WHERE
            ( ( @sCo_Sucur_d IS NULL
                OR co_sucur >= @sCo_Sucur_d
              )
              AND ( @sCo_Sucur_h IS NULL
                    OR co_sucur <= @sCo_Sucur_h
                  )
            )
            AND ( @sCo_Sucursal IS NULL
                  OR co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'sucur_des' THEN sucur_des
                                 ELSE co_sucur
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'sucur_des' THEN sucur_des
                                          ELSE co_sucur
                                        END
                      END ASC
    END
```
