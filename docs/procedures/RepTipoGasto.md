# SP: RepTipoGasto
**Tipo**: Reporte
**Módulo**: General

## Tablas Referenciadas
- [`saTipoGasto`](../tables/saTipoGasto.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[RepTipoGasto]
    @sCo_Gasto_d CHAR(4) = NULL ,
    @sCo_Gasto_h CHAR(4) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        SELECT
            *
        FROM
            saTipoGasto
        WHERE
            ( ( @sCo_Gasto_d IS NULL
                OR @sCo_Gasto_d <= co_gasto
              )
              AND ( @sCo_Gasto_h IS NULL
                    OR co_gasto <= @sCo_Gasto_h
                  )
            )
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'des_tipo' THEN des_tipo
                                 ELSE co_gasto
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'des_tipo' THEN des_tipo
                                          ELSE co_gasto
                                        END
                      END ASC
    END
```
