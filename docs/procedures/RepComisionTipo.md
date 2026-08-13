# SP: RepComisionTipo
**Tipo**: Reporte
**Módulo**: General

## Tablas Referenciadas
- [`saComisionTipo`](../tables/saComisionTipo.md)

## Código (excerpt)
```sql
-- Create date: <07-06-11>
-- Description:	<Tipo de Comisión>
-- =============================================
CREATE PROCEDURE [RepComisionTipo]
	-- Add the parameters for the stored procedure here
    @sCo_Comi_d CHAR(6) = NULL ,
    @sCo_Comi_h CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        SELECT
            co_comi, des_comi, campo1, campo2, campo3, campo4, campo5, campo6, campo7, campo8
        FROM
            saComisionTipo
        WHERE
            ( ( @sCo_Comi_d IS NULL
                OR @sCo_Comi_d <= co_comi
              )
              AND ( @sCo_Comi_h IS NULL
                    OR co_comi <= @sCo_Comi_h
                  )
            )
            AND ( @sCo_Sucursal IS NULL
                  OR co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'co_comi' THEN co_comi                       
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'co_comi' THEN co_comi                                     
                                        END
                      END ASC
    END
```
