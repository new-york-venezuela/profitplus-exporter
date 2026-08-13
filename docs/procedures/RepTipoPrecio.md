# SP: RepTipoPrecio
**Tipo**: Reporte
**Módulo**: General

## Tablas Referenciadas
- [`saTipoPrecio`](../tables/saTipoPrecio.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <19-07-10>
-- Description:	<Tipos de Precios>
-- =============================================
CREATE PROCEDURE [RepTipoPrecio]
	-- Add the parameters for the stored procedure here
    @sCo_Prec_d CHAR(6) = NULL ,
    @sCo_Prec_h CHAR(6) = NULL ,
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
            saTipoPrecio
        WHERE
            ( ( @sCo_Prec_d IS NULL
                OR co_precio >= @sCo_Prec_d
              )
              AND ( @sCo_Prec_h IS NULL
                    OR co_precio <= @sCo_Prec_h
                  )
            )
            AND ( @sCo_Sucursal IS NULL
                  OR co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'des_precio' THEN des_precio
                                 ELSE co_precio
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'des_precio' THEN des_precio
                                          ELSE co_precio
                                        END
                      END ASC
    END
```
