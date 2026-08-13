# SP: RepContabilizacionesDatosGenerales
**Tipo**: Reporte
**Módulo**: General

## Tablas Referenciadas
- [`saIntegr`](../tables/saIntegr.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		<SOFTECH SISTEMAS>
-- Create date: <24-08-2011>
-- Description:	<Contabilizaciones con sus datos Generales>
-- =============================================
CREATE PROCEDURE [RepContabilizacionesDatosGenerales] 
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

	-- CONSULTA DE RETORNO  CON LOS DATOS DE CONTABILIZACION QUE CUMPLEN CON LOS FILTROS DADOS
	SELECT    inte_num, fec_emis, desde, hasta, feccom, numcom, des_inte, docnoint, marcar, val_cuad, compxfec, compxtip, criterio, agrupam, compras, pagos, 
		  dev_pro, ncr_pro, ndb_pro, gir_pro, chdev_pro, /*adel_pro, islr_pro,*/ ventas, cobros, dev_cli, ncr_cli, ndb_cli, gir_cli, chdev_cli, /*adel_cli, islr_cli,*/ 
		  ord_pago, mov_caja, mov_banco, ajustes, not_ent, com_gen, nomina, not_rec, todos, revisado,act_ultf, placom, plavent, ajupr, ajucl, tras_alm, 
		  pedidos, ordenes
	FROM       dbo.saintegr  
	WHERE 
		-- FILTRO DE NUMERO DE LA CONTABILIZACION
		((@cNumero_d is null or @cNumero_d <= inte_num ) and (@cNumero_h is null or inte_num <= @cNumero_h ))
		-- FILTRO DE FECHA DE LA CONTABILIZACION
		 AND ((@dFecha_d is null or @dFecha_d <= fec_emis ) and (@dFecha_h is null or fec_emis <= @dFecha_h ))

	ORDER BY 
--> por fecha
	CASE @sDir
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
