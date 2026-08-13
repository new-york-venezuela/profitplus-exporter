# SP: RepTipoImagen
**Tipo**: Reporte
**Módulo**: General

## Tablas Referenciadas
- [`saTipoImagen`](../tables/saTipoImagen.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <22-09-14>
-- Description:	<Listado de Tipo de Imagen>
-- =============================================
CREATE PROCEDURE [dbo].[RepTipoImagen]
	-- Add the parameters for the stored procedure here
    @sCo_Tipo_Imag_d CHAR(6) = NULL ,
    @sCo_Tipo_Imag_h CHAR(6) = NULL ,
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
            saTipoImagen
        WHERE
            ( ( @sCo_Tipo_Imag_d IS NULL
                OR @sCo_Tipo_Imag_d <= co_tipo_imag
              )
              AND ( @sCo_Tipo_Imag_h IS NULL
                    OR co_tipo_imag <= @sCo_Tipo_Imag_h
                  )
            )
            AND ( @sCo_Sucursal IS NULL
                  OR co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'descrip' THEN descrip
                                 ELSE co_tipo_imag
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'descrip' THEN descrip
                                          ELSE co_tipo_imag
                                        END
                      END ASC
    END
```
