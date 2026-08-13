# SP: RepUbicacion
**Tipo**: Reporte
**Módulo**: General

## Tablas Referenciadas
- [`saUbicacion`](../tables/saUbicacion.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <10-03-10>
-- Description:	<Reportes de Ubicacion>
-- =============================================
CREATE PROCEDURE [RepUbicacion]
	-- Add the parameters for the stored procedure here
    @sCo_Ubicacion_d CHAR(6) = NULL ,
    @sCo_Ubicacion_h CHAR(6) = NULL ,
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
            saUbicacion
        WHERE
            ( ( @sCo_Ubicacion_d IS NULL
                OR co_ubicacion >= @sCo_Ubicacion_d
              )
              AND ( @sCo_Ubicacion_h IS NULL
                    OR co_ubicacion <= @sCo_Ubicacion_h
                  )
            )
            AND ( @sCo_Sucursal IS NULL
                  OR co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'des_ubicacion' THEN des_ubicacion
                                 ELSE co_ubicacion
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'des_ubicacion' THEN des_ubicacion
                                          ELSE co_ubicacion
                                        END
                      END ASC
    END
```
