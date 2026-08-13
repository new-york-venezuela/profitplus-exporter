# SP: RepPuntoEmision
**Tipo**: Reporte
**Módulo**: General

## Tablas Referenciadas
- [`saPuntoEmision`](../tables/saPuntoEmision.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[RepPuntoEmision]
    @sCo_Punto_Emi_d CHAR(3) = NULL ,
    @sCo_Punto_Emi_h CHAR(3) = NULL ,
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
            saPuntoEmision
        WHERE
            ( ( @sCo_Punto_Emi_d IS NULL
                OR @sCo_Punto_Emi_d <= co_punto_emi
              )
              AND ( @sCo_Punto_Emi_h IS NULL
                    OR co_punto_emi <= @sCo_Punto_Emi_h
                  )
            )
            AND ( @sCo_Sucursal IS NULL
                  OR co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'des_punto_emi' THEN des_punto_emi
                                 ELSE co_punto_emi
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'des_punto_emi' THEN des_punto_emi
                                          ELSE co_punto_emi
                                        END
                      END ASC
    END
```
