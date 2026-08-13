# SP: RepProcedencia
**Tipo**: Reporte
**Módulo**: General

## Tablas Referenciadas
- [`saProcedencia`](../tables/saProcedencia.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <02-03-10>
-- Description:	<Listado de las Procedencias>
-- =============================================
CREATE PROCEDURE [RepProcedencia]
	-- Add the parameters for the stored procedure here
    @sCod_Proc_d CHAR(6) = NULL ,
    @sCod_Proc_h CHAR(6) = NULL ,
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
            saProcedencia
        WHERE
            ( ( @sCod_Proc_d IS NULL
                OR @sCod_Proc_d <= cod_proc
              )
              AND ( @sCod_Proc_h IS NULL
                    OR cod_proc <= @sCod_Proc_h
                  )
            )
            AND ( @sCo_Sucursal IS NULL
                  OR co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'des_proc' THEN des_proc
                                 ELSE cod_proc
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'des_proc' THEN des_proc
                                          ELSE cod_proc
                                        END
                      END ASC
    END
```
