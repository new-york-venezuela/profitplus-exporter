# SP: RepBeneficiario
**Tipo**: Reporte
**Módulo**: General

## Tablas Referenciadas
- [`saBeneficiario`](../tables/saBeneficiario.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <04-03-10>
-- Description:	<Listado de Beneficiarios>
-- =============================================
CREATE PROCEDURE [RepBeneficiario]
	-- Add the parameters for the stored procedure here
    @sCo_bene_d CHAR(10) = NULL ,
    @sCo_bene_h CHAR(10) = NULL ,
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
            saBeneficiario
        WHERE
            ( ( @sCo_bene_d IS NULL
                OR cod_ben >= @sCo_bene_d
              )
              AND ( @sCo_bene_h IS NULL
                    OR cod_ben <= @sCo_bene_h
                  )
            )
            AND ( @sCo_Sucursal IS NULL
                  OR co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'ben_des' THEN ben_des
                                 ELSE cod_ben
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'ben_des' THEN ben_des
                                          ELSE cod_ben
                                        END
                      END ASC
    END
```
