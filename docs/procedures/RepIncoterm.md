# SP: RepIncoterm
**Tipo**: Reporte
**Módulo**: General

## Tablas Referenciadas
- [`saIncoterm`](../tables/saIncoterm.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS 
-- Create date: <27-04-2015>
-- Description:	<Listado de Incoterm>
-- =============================================
CREATE PROCEDURE [dbo].[RepIncoterm]
	-- Add the parameters for the stored procedure here
	@sCo_incoterm_d CHAR(6) = NULL,
	@sCo_incoterm_h CHAR(6) = NULL,
	@iSecuencia_d INT = NULL,
	@iSecuencia_h INT = NULL,
	@sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS
BEGIN
	SET NOCOUNT ON;

	SELECT 
		*
	FROM
		saIncoterm
	WHERE
            ( ( @sCo_incoterm_d IS NULL
                OR @sCo_incoterm_d <= co_incoterm
              )
              AND ( @sCo_incoterm_h IS NULL
                    OR co_incoterm <= @sCo_incoterm_h
                  )
            )
            AND 
			( ( @iSecuencia_d IS NULL
                OR @iSecuencia_d <= secuencia
              )
              AND ( @iSecuencia_h IS NULL
                    OR secuencia <= @iSecuencia_h
                  )
            )
			/* se comenta por sit 125127 jortiz
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'secuencia' THEN secuencia
                                 ELSE co_incoterm
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'secuencia' THEN secuencia
                                          ELSE co_incoterm
                                        END
                      END ASC 
					  */
		


			--inicia sit 125127 jortiz
	 Order by
	         CASE @sDir
                    WHEN 'DESC' THEN CASE @sCampOrderBy
                                        WHEN 'secuencia' THEN secuencia
                                     end
             end DESC, 
	        CASE @sDir
                    WHEN 'DESC' THEN CASE when @sCampOrderBy <> 'secuencia' then co_incoterm
	        		                end 
	        end DESC,
	        CASE @sDir
                    WHEN 'ASC' THEN CASE @sCampOrderBy
                                        WHEN 'secuencia' THEN secuencia
                                    end
             end ASC, 
	        CASE @sDir
                    WHEN 'ASC' THEN CASE when @sCampOrderBy <> 'secuencia' then co_incoterm
	        		                end 
	        end ASC

		--fi
```
