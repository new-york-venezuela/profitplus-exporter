# SP: RepTipoDocumento
**Tipo**: Reporte
**Módulo**: General

## Tablas Referenciadas
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <23-09-14>
-- Description:	<Listado de Tipo de Documento>
-- =============================================
CREATE PROCEDURE [dbo].[RepTipoDocumento]
	-- Add the parameters for the stored procedure here
    @sCo_Tipo_Doc_d CHAR(6) = NULL ,
    @sCo_Tipo_Doc_h CHAR(6) = NULL ,
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
            saTipoDocumento
        WHERE
            ( ( @sCo_Tipo_Doc_d IS NULL
                OR @sCo_Tipo_Doc_d <= co_tipo_doc
              )
              AND ( @sCo_Tipo_Doc_h IS NULL
                    OR co_tipo_doc <= @sCo_Tipo_Doc_h
                  )
            )
            AND ( @sCo_Sucursal IS NULL
                  OR co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            CASE @sDir
				WHEN 'DESC' THEN CASE @sCampOrderBy
									WHEN 'descrip' THEN descrip
									ELSE co_tipo_doc
								END
            END DESC, 
			CASE @sDir
				WHEN 'ASC' THEN CASE @sCampOrderBy
									WHEN 'descrip' THEN descrip
									ELSE co_tipo_doc
								END
			END ASC
    END
```
