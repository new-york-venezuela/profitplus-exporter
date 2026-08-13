# SP: RepSegmento
**Tipo**: Reporte
**Módulo**: General

## Tablas Referenciadas
- [`saSegmento`](../tables/saSegmento.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <02-03-10>
-- Description:	<Listado de Segmentos>
-- =============================================
CREATE PROCEDURE [RepSegmento]
	-- Add the parameters for the stored procedure here
    @sCo_Seg_d CHAR(6) = NULL ,
    @sCo_Seg_h CHAR(6) = NULL ,
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
            saSegmento
        WHERE
            ( ( @sCo_Seg_d IS NULL
                OR @sCo_Seg_d <= co_seg
              )
              AND ( @sCo_Seg_h IS NULL
                    OR co_seg <= @sCo_Seg_h
                  )
            )
            AND ( @sCo_Sucursal IS NULL
                  OR co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'seg_des' THEN seg_des
                                 ELSE co_seg
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'seg_des' THEN seg_des
                                          ELSE co_seg
                                        END
                      END ASC
    END
```
