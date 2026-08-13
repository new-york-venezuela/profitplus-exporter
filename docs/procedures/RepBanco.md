# SP: RepBanco
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <01-03-10>
-- Description:	<Listado de Bancos>
-- =============================================
CREATE PROCEDURE [RepBanco]
	-- Add the parameters for the stored procedure here
    @sCo_Banco_d CHAR(6) = NULL ,
    @sCo_Banco_h CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        SELECT
            *
        FROM
            saBanco
        WHERE
            ( ( @sCo_Banco_d IS NULL
                OR co_ban >= @sCo_Banco_d
              )
              AND ( @sCo_Banco_h IS NULL
                    OR co_ban <= @sCo_Banco_h
                  )
            )
            AND ( @sCo_Sucursal IS NULL
                  OR co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'des_ban' THEN des_ban
                                 ELSE co_ban
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'des_ban' THEN des_ban
                                          ELSE co_ban
                                        END
                      END ASC
    END
```
