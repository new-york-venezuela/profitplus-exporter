# SP: RepTarjetaCredito
**Tipo**: Reporte
**Módulo**: General

## Tablas Referenciadas
- [`saTarjetaCredito`](../tables/saTarjetaCredito.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <04-03-10>
-- Description:	<Reportes de tarjetas de creditos>
-- =============================================
CREATE PROCEDURE [RepTarjetaCredito]
	-- Add the parameters for the stored procedure here
    @sCo_Tarjeta_d CHAR(6) = NULL ,
    @sCo_Tarjeta_h CHAR(6) = NULL ,
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
            saTarjetaCredito
        WHERE
            ( ( @sCo_Tarjeta_d IS NULL
                OR co_tar >= @sCo_Tarjeta_d
              )
              AND ( @sCo_Tarjeta_h IS NULL
                    OR co_tar <= @sCo_Tarjeta_h
                  )
            )
            AND ( @sCo_Sucursal IS NULL
                  OR co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'des_tar' THEN des_tar
                                 ELSE co_tar
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'des_tar' THEN des_tar
                                          ELSE co_tar
                                        END
                      END ASC
    END
```
