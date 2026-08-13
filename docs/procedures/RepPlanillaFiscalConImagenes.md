# SP: RepPlanillaFiscalConImagenes
**Tipo**: Reporte
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)
- [`saPlanillaFiscal`](../tables/saPlanillaFiscal.md)
- [`saTipoImagen`](../tables/saTipoImagen.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <01/12/2015>
-- Description:	<Planilla Fiscal Con Imagenes>
-- =============================================
CREATE PROCEDURE [dbo].[RepPlanillaFiscalConImagenes]
	-- Add the parameters for the stored procedure here
    @sCo_plan_d CHAR(6) = NULL,
    @sCo_plan_h CHAR(6) = NULL,
    @sTipo_d CHAR(4) = NULL,
    @sTipo_h CHAR(4) = NULL,    
    @sCo_tipo_img_d char(6) = NULL,
	@sCo_tipo_img_h char(6) = NULL,
	@sCo_Sucursal CHAR(6) = NULL,
    @sCampOrderBy VARCHAR(16) = NULL,
    @sDir VARCHAR(6) = NULL,
    @bHeaderRep BIT = 0,
	@sNombreDBMaestra VARCHAR(max)
AS 
    BEGIN
        SET NOCOUNT ON ;

		DECLARE @query NVARCHAR(max)
		SET @query = 'select co_fijo, co_grupo, desc_fijo, producto from '+ @sNombreDBMaestra +'.[dbo].[MpFijo]'

		DECLARE @TablaFijos TABLE
					(
					  co_fijo char(4) ,
					  co_grupo CHAR(3),
					  desc_fijo varchar(60),
					  producto char(6)
					)

		INSERT INTO
		@TablaFijos
		EXEC sp_executesql @query
		        
        SELECT
            PF.cod_plan, PF.des_plan, PF.tipo, (select desc_fijo from @TablaFijos where co_grupo = 'PF' and producto = 'ADMI' and co_fijo = PF.tipo) AS
			des_tipo, PF.numero_plan, PF.ano, PF.mes, DI.co_imag, DI.des_imag, DI.picture, DI.co_tipo_imag, TI.descrip AS 
			descripImagen
        FROM
            saPlanillaFiscal AS PF            
			left outer join saDocumentoImagen DI ON PF.rowguid = DI.rowguidDoc
			INNER JOIN saTipoImagen TI ON DI.co_tipo_imag = TI.co_tipo_imag
        WHERE			
			DI.co_imag IS NOT NULL AND
            ((@sCo_plan_d IS NULL OR PF.cod_plan >= @sCo_plan_d) AND (@sCo_plan_h IS NULL OR pf.cod_plan <= @sCo_plan_h)) AND			
			((@sTipo_d IS NULL OR PF.tipo >= @sTipo_d) AND (@sTipo_h IS NULL OR PF.tipo <= @sTipo_h)) AND
			((@sCo_tipo_img_d IS NULL OR TI.co_tipo_imag >= @sCo_tipo_img_d) AND (@sCo_tipo_img_h IS NULL OR TI.co_tipo_imag <= @sCo_tipo_img_h)) AND
			(@sCo_Sucursal IS NULL OR PF.co_sucu_in = @sCo_Sucursal)
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'des_plan' THEN PF.des_plan
                                 ELSE PF.cod_plan
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'des_plan' THEN PF.des_plan
```
