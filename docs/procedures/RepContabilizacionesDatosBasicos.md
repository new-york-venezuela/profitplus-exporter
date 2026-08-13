# SP: RepContabilizacionesDatosBasicos
**Tipo**: Reporte
**Módulo**: General

## Tablas Referenciadas
- [`saIntegr`](../tables/saIntegr.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		<SOFTECH SISTEMAS>
-- Create date: <24-08-2011>
-- Description:	<Contabilizaciones con sus datos basicos>
-- =============================================
CREATE PROCEDURE [RepContabilizacionesDatosBasicos] 
	@cNumero_d CHAR(20) = null, --numero de la contabilizacion
	@cNumero_h CHAR(20) = null,
	@dFecha_d smalldatetime = null, -- fecha de la contabilizacion
	@dFecha_h smalldatetime = null,
	@sCampOrderBy varchar(16) = null,
	@sDir varchar(6) = null,
    @bHeaderRep bit = 0

AS
BEGIN
	
	SET NOCOUNT ON;

	-- CONSULTA DE RETOTNO CON LOS DATOS DE CONTABILIZACIONES ALMACENADOS EN LA TABLA SCINTEGR QUE CUMPLAN CON LOS FILTROS
	SELECT     inte_num, des_inte, fec_emis, desde, hasta, numcom, feccom
	FROM       dbo.saintegr    
	WHERE
		-- FILTRO DE NUMERO DE CONTABILIZACION 
		((@cNumero_d is null or @cNumero_d <= inte_num ) and (@cNumero_h is null or inte_num <= @cNumero_h ))
		-- FILTRO DE FECHA DE LA CONTABILIZACION
		 AND ((@dFecha_d is null or @dFecha_d <= fec_emis ) and (@dFecha_h is null or fec_emis <= @dFecha_h ))
	ORDER BY 
	CASE @sDir --> por fecha
		WHEN 'DESC' THEN  CASE @sCampOrderBy 
							WHEN 'fec_emis' THEN fec_emis
						  END 
	END DESC,
	CASE @sDir 
		WHEN 'ASC' THEN CASE @sCampOrderBy 
							WHEN 'fec_emis' THEN fec_emis
						END 
	END	ASC,
-->por número
	CASE @sDir 
		WHEN 'DESC' THEN  CASE @sCampOrderBy 
							WHEN 'inte_num' THEN inte_num
						  END 
	END DESC,
	CASE @sDir 
		WHEN 'ASC' THEN CASE @sCampOrderBy 
							WHEN 'inte_num' THEN inte_num
						END 
	END	ASC
END
```
