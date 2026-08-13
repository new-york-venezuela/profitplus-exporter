# SP: RepAlmacen
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAlmacen`](../tables/saAlmacen.md)
- [`saSucursal`](../tables/saSucursal.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <10-03-10>
-- Description:	<Reporte de Almacen>
-- =============================================
CREATE PROCEDURE [RepAlmacen]
	-- Add the parameters for the stored procedure here
    @sCo_Alma_d CHAR(6) = NULL ,
    @sCo_Alma_h CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        SELECT
            A.*, S.sucur_des
        FROM
            saAlmacen AS A
            INNER JOIN saSucursal AS S ON A.co_sucur = S.co_sucur
        WHERE
            ( ( @sCo_Alma_d IS NULL
                OR co_alma >= @sCo_Alma_d
              )
              AND ( @sCo_Alma_h IS NULL
                    OR co_alma <= @sCo_Alma_h
                  )
            )
            AND ( @sCo_Sucursal IS NULL
                  OR A.co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'des_alma' THEN des_alma
                                 ELSE co_alma
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'des_alma' THEN des_alma
                                          ELSE co_alma
                                        END
                      END ASC
    END
```
