# SP: RepTipoComprobante
**Tipo**: Reporte
**Módulo**: General

## Tablas Referenciadas
- [`saTipoComprobante`](../tables/saTipoComprobante.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[RepTipoComprobante]
	-- Add the parameters for the stored procedure here
    @sCo_Tipo_d CHAR(2) = NULL ,
    @sCo_Tipo_h CHAR(2) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        SELECT
            *
        FROM
            saTipoComprobante
        WHERE
            ( ( @sCo_Tipo_d IS NULL
                OR @sCo_Tipo_d <= co_tipo
              )
              AND ( @sCo_Tipo_h IS NULL
                    OR co_tipo <= @sCo_Tipo_h
                  )
            )
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'des_tipo' THEN des_tipo
                                 ELSE co_tipo
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'des_tipo' THEN des_tipo
                                          ELSE co_tipo
                                        END
                      END ASC
    END
```
