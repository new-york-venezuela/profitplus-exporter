# SP: RepTipoAjuste
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saTipoAjuste`](../tables/saTipoAjuste.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <04-03-10>
-- Description:	<Tipos de ajustes>
-- =============================================
CREATE PROCEDURE [RepTipoAjuste]
	-- Add the parameters for the stored procedure here
    @sCo_TipoAjuste_d CHAR(6) = NULL ,
    @sCo_TipoAjuste_h CHAR(6) = NULL ,
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
            saTipoAjuste
        WHERE
            ( ( @sCo_TipoAjuste_d IS NULL
                OR co_tipo >= @sCo_TipoAjuste_d
              )
              AND ( @sCo_TipoAjuste_h IS NULL
                    OR co_tipo <= @sCo_TipoAjuste_h
                  )
            )
            AND ( @sCo_Sucursal IS NULL
                  OR co_sucu_in = @sCo_Sucursal
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
