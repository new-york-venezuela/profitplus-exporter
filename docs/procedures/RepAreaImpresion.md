# SP: RepAreaImpresion
**Tipo**: Reporte
**Módulo**: General

## Tablas Referenciadas
- [`saAreaImpresion`](../tables/saAreaImpresion.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[RepAreaImpresion]
	-- Add the parameters for the stored procedure here
    @sCo_Area_Imp_d CHAR(3) = NULL ,
    @sCo_Area_Imp_h CHAR(3) = NULL ,
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
            saAreaImpresion
        WHERE
            ( ( @sCo_Area_Imp_d IS NULL
                OR @sCo_Area_Imp_d <= co_area_imp
              )
              AND ( @sCo_Area_Imp_h IS NULL
                    OR co_area_imp <= @sCo_Area_Imp_h
                  )
            )
            AND ( @sCo_Sucursal IS NULL
                  OR co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'des_area_imp' THEN des_area_imp
                                 ELSE co_area_imp
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'des_area_imp' THEN des_area_imp
                                          ELSE co_area_imp
                                        END
                      END ASC
    END
```
