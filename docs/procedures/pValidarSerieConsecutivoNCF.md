# SP: pValidarSerieConsecutivoNCF
**Tipo**: Validar
**Módulo**: General

## Tablas Referenciadas
- [`saSerie`](../tables/saSerie.md)
- [`saSerieTipo`](../tables/saSerieTipo.md)
- [`saSerieTipoExt`](../tables/saSerieTipoExt.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			: pValidarSerieConsecutivoNCF
*DESCRIPCIÓN	: Valida la serie consecutivo NCF
*FECHA CREACIÓN: <2019-05-28>
*AUTOR			: SOFTECH SISTEMAS
************************************************************************/
CREATE PROCEDURE [dbo].[pValidarSerieConsecutivoNCF]
	(
		@sCo_serie CHAR(20),
		@sCo_consecutivo CHAR(16)
	)
AS
BEGIN

DECLARE @resp BIT = 1
DECLARE @Tipo CHAR(2)

SET @sCo_consecutivo = LTRIM(SUBSTRING(@sCo_consecutivo, 1, LEN(@sCo_consecutivo)-3))

DECLARE @result TABLE
			(
				CoTipo CHAR(2)
			)

		IF(@sCo_consecutivo='FACT_CONS_FIN' OR @sCo_consecutivo='FACT_REG_UNI' OR @sCo_consecutivo='FACT_VAL_FISC' OR
			@sCo_consecutivo='FACT_VTA_EXP' OR @sCo_consecutivo='GUBERNAME_NCF' OR @sCo_consecutivo='N/CR_VTA_NCF' OR
			@sCo_consecutivo='N/DB_VTA_NCF' OR @sCo_consecutivo='PROV_INFORMAL' OR @sCo_consecutivo='REG_ESP_TRIBU' OR 
			@sCo_consecutivo='REG_GAST_MEN' OR @sCo_consecutivo='REG_PAG_EXT')
			BEGIN

			SET @Tipo=CASE WHEN @sCo_consecutivo= 'FACT_VAL_FISC' THEN '01' WHEN @sCo_consecutivo= 'FACT_CONS_FIN' THEN '02'
				WHEN @sCo_consecutivo= 'N/DB_VTA_NCF' THEN '03' WHEN @sCo_consecutivo= 'N/CR_VTA_NCF' THEN '04'
				WHEN @sCo_consecutivo= 'PROV_INFORMAL' THEN '11' WHEN @sCo_consecutivo= 'FACT_REG_UNI' THEN '12'
				WHEN @sCo_consecutivo= 'REG_GAST_MEN' THEN '13' WHEN @sCo_consecutivo= 'REG_ESP_TRIBU' THEN '14'
				WHEN @sCo_consecutivo= 'GUBERNAME_NCF' THEN '15' WHEN @sCo_consecutivo= 'FACT_VTA_EXP' THEN '16'
				WHEN @sCo_consecutivo= 'REG_PAG_EXT' THEN '17' END

				INSERT INTO @result (CoTipo)		
				SELECT
					STX.co_tipo 					
				FROM 
					saSerie S 
					INNER JOIN saSerieTipo ST ON S.co_tipo_serie = ST.co_tipo_serie
					INNER JOIN saSerieTipoExt STX ON ST.rowguid = STX.rowguid_serietipo					
				WHERE S.co_serie = @sCo_serie

				IF(SELECT CoTipo FROM @result) IS NOT NULL
					BEGIN
						IF(SELECT CoTipo FROM @result) <> @Tipo
						BEGIN
							SET @resp = 0
						END
					END
				ELSE	
					BEGIN
							SET @resp = 0
					END		
			END

		SELECT @resp
END
```
