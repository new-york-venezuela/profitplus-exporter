# SP: RepLineaConSubLinea
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saLineaArticulo`](../tables/saLineaArticulo.md)
- [`saSubLinea`](../tables/saSubLinea.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <15-03-10>
-- Description:	<Linea con Sub-Linea>
-- =============================================
CREATE PROCEDURE [RepLineaConSubLinea]
	-- Add the parameters for the stored procedure here
    @sCo_Linea_d CHAR(6) = NULL ,
    @sCo_Linea_h CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        SELECT
            LA.co_lin, LA.lin_des, SL.co_subl, SL.subl_des
        FROM
            saLineaArticulo AS LA
            LEFT JOIN saSubLinea SL ON LA.co_lin = SL.co_lin
        WHERE
            ( ( @sCo_Linea_d IS NULL
                OR LA.co_lin >= @sCo_Linea_d
              )
              AND ( @sCo_Linea_h IS NULL
                    OR LA.co_lin <= @sCo_Linea_h
                  )
            )
            AND ( @sCo_Sucursal IS NULL
                  OR LA.co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'lin_des' THEN LA.lin_des
                                 ELSE LA.co_lin
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'lin_des' THEN LA.lin_des
                                          ELSE LA.co_lin
                                        END
                      END ASC
    END
```
