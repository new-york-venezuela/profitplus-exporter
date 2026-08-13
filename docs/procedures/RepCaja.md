# SP: RepCaja
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCaja`](../tables/saCaja.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <30-04-09>
-- Description:	<Reporte de las Cajas Registradas>
-- =============================================
CREATE PROCEDURE [RepCaja]
	-- Add the parameters for the stored procedure here
    @sCod_Caja_d CHAR(6) = NULL ,
    @sCod_Caja_h CHAR(6) = NULL ,
    @sCo_Moneda CHAR(6) = NULL ,
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
            sacaja
        WHERE
            ( ( @sCod_Caja_d IS NULL
                OR cod_caja >= @sCod_Caja_d
              )
              AND ( @sCod_Caja_h IS NULL
                    OR cod_caja <= @sCod_Caja_h
                  )
            )
            AND ( @sCo_Moneda IS NULL
                  OR co_mone = @sCo_Moneda
                )
            AND ( @sCo_Sucursal IS NULL
                  OR co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'descrip' THEN descrip
                                 ELSE cod_caja
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'descrip' THEN descrip
                                          ELSE cod_caja
                                        END
                      END ASC
    END
```
