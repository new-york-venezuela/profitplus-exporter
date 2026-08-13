# SP: RepSubLinea
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saLineaArticulo`](../tables/saLineaArticulo.md)
- [`saSubLinea`](../tables/saSubLinea.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <10-03-10>
-- Description:	<Reportes de Sublinea>
-- =============================================
CREATE PROCEDURE [RepSubLinea]
	-- Add the parameters for the stored procedure here
    @sCo_SubLinea_d CHAR(6) = NULL ,
    @sCo_SubLinea_h CHAR(6) = NULL ,
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
            S.*, L.lin_des
        FROM
            saSubLinea AS S
            LEFT JOIN salineaArticulo AS L ON S.co_lin = L.co_lin
        WHERE
            ( ( @sCo_Linea_d IS NULL
                OR S.co_lin >= @sCo_Linea_d
              )
              AND ( @sCo_Linea_h IS NULL
                    OR S.co_lin <= @sCo_Linea_h
                  )
            )
            AND ( ( @sCo_SubLinea_d IS NULL
                    OR S.co_subl >= @sCo_SubLinea_d
                  )
                  AND ( @sCo_SubLinea_h IS NULL
                        OR S.co_subl <= @sCo_SubLinea_h
                      )
                )
            AND ( @sCo_Sucursal IS NULL
                  OR S.co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'subl_des' THEN S.subl_des
                                 ELSE S.co_subl
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'subl_des' THEN S.subl_des
                                          ELSE S.co_subl
                                        END
                      END ASC
    END
```
