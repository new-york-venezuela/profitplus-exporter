# SP: RepTipoAnulacionVenta
**Tipo**: Reporte
**Módulo**: General

## Tablas Referenciadas
- [`saTipoAnulacionVenta`](../tables/saTipoAnulacionVenta.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[RepTipoAnulacionVenta]
    @sCo_Anulacion_d CHAR(4) = NULL ,
    @sCo_Anulacion_h CHAR(4) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        SELECT
            *
        FROM
            saTipoAnulacionVenta
        WHERE
            ( ( @sCo_Anulacion_d IS NULL
                OR @sCo_Anulacion_d <= co_anulacion
              )
              AND ( @sCo_Anulacion_h IS NULL
                    OR co_anulacion <= @sCo_Anulacion_h
                  )
            )
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'des_tipo' THEN des_tipo
                                 ELSE co_anulacion
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'des_tipo' THEN des_tipo
                                          ELSE co_anulacion
                                        END
                      END ASC
    END
```
