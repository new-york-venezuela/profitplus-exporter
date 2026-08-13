# SP: RepCuentaIngEgr
**Tipo**: Reporte
**Módulo**: General

## Tablas Referenciadas
- [`saCuentaIngEgr`](../tables/saCuentaIngEgr.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <04-03-10>
-- Description:	<Cuentas de ingresos y egreso>
-- =============================================
CREATE PROCEDURE [RepCuentaIngEgr]
	-- Add the parameters for the stored procedure here
    @sCo_IngEgr_d CHAR(20) = NULL ,
    @sCo_IngEgr_h CHAR(20) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(20) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        SELECT
            *
        FROM
            saCuentaIngEgr
        WHERE
            ( ( @sCo_IngEgr_d IS NULL
                OR co_cta_ingr_egr >= @sCo_IngEgr_d
              )
              AND ( @sCo_IngEgr_h IS NULL
                    OR co_cta_ingr_egr <= @sCo_IngEgr_h
                  )
            )
            AND ( @sCo_Sucursal IS NULL
                  OR co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'descrip' THEN descrip
                                 ELSE co_cta_ingr_egr
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'descrip' THEN descrip
                                          ELSE co_cta_ingr_egr
                                        END
                      END ASC
    END
```
