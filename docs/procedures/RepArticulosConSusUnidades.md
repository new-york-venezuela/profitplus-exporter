# SP: RepArticulosConSusUnidades
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saUnidad`](../tables/saUnidad.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		<SOFTECH SISTEMAS>
-- Create date: <04-06-15>
-- Description:	<Reporte de Artículos con sus Unidades>
-- =============================================
CREATE PROCEDURE  [dbo].[RepArticulosConSusUnidades]
	-- Add the parameters for the stored procedure here
	@sCo_Art_d CHAR(30) = NULL,
	@sCo_Art_h CHAR(30) = NULL,
	@sCo_Lin_d char(6) = NULL,
	@sCo_Lin_h char(6) = NULL,
	@sCo_Subl_d char(6) = NULL,
	@sCo_Subl_h char(6) = NULL,
	@sCo_Cat_d char(6) = NULL,
	@sCo_Cat_h char(6) = NULL,
	@sCo_Uni_d char(6) = NULL,
	@sCo_Uni_h char(6) = NULL,
	@sCo_Suc char(6) = NULL,
	@sCampOrderBy varchar(16) = NULL,
	@sDir varchar(6) = NULL,
	@bHeaderRep bit = 0
AS
BEGIN
	SET NOCOUNT ON;
	

Select  A.co_art, A.art_des, AU.uso_principal, a.relac_unidad, AU.uso_secundaria, AU.co_uni, U.des_uni,
	    AU.uni_principal, AU.uso_principal, AU.uni_secundaria, AU.uso_secundaria, AU.relacion,
		AU.equivalencia, AU.uso_numDecimales, AU.num_decimales

FROM
	    saArticulo                   AS A
		LEFT JOIN saArtUnidad        AS AU ON	         AU.co_art = A.co_art
		INNER JOIN saUnidad          AS U ON             U.co_uni = AU.co_uni

WHERE
		(@sCo_art_d IS NULL OR A.co_art >= @sCo_art_d) AND
		(@sCo_art_h IS NULL OR A.co_art <= @sCo_art_h) AND
		(@sCo_Lin_d IS NULL OR A.co_lin >= @sCo_Lin_d) AND 
		(@sCo_Lin_h IS NULL OR A.co_lin <= @sCo_Lin_h) AND
		(@sCo_Subl_d IS NULL OR A.co_subl >= @sCo_Subl_d) AND 
		(@sCo_Subl_h IS NULL OR A.co_subl <= @sCo_Subl_h) AND
		(@sCo_Cat_d IS NULL OR A.co_cat >= @sCo_Cat_d) AND 
		(@sCo_Cat_h IS NULL OR A.co_cat <= @sCo_Cat_h) AND
		(@sCo_Uni_d IS NULL OR AU.co_uni >= @sCo_Uni_d) AND 
		(@sCo_Uni_h IS NULL OR AU.co_uni <= @sCo_Uni_h) AND
		(@sCo_Suc IS NULL OR A.co_sucu_in = @sCo_Suc)
ORDER BY 
	AU.co_art DESC, AU.uni_principal DESC, AU.uso_principal DESC, AU.uni_secundaria DESC, AU.uso_secundaria DESC
		--CASE @sDir 
		--	WHEN 'DESC' THEN  
		--		CASE @sCampOrderBy 
		--			WHEN 'art_des' THEN A.art_des
		--			ELSE A.co_art
		--		END 
		--END 
		--	DESC,
		--CASE @sDir 
		--	WHEN 'ASC' THEN	
		--		CASE @sCampOrderBy 
		--			WHEN 'art_des' THEN A.art_des
		--			ELSE A.co_art
		--		END 
		--END
		--ASC
END
```
