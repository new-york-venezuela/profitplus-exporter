# SP: RepDiferenciaReglasIntegracion
**Tipo**: Reporte
**Módulo**: General

## Tablas Referenciadas
- [`saReglaInt`](../tables/saReglaInt.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		<SOFTECH CONSULTORES C.A.>
-- Create date: <31-01-2017>
-- Description:	Reporte que lista el conjunto
-- de las reglas de integración que han sido
-- modificadas.
-- =============================================
CREATE PROCEDURE [dbo].[RepDiferenciaReglasIntegracion]
	@sCo_reg_d			VARCHAR(10) = NULL, -- CODIGO DE REGLA DE INTEGRACION
	@sCo_reg_h			VARCHAR(10) = NULL,	
	@bMostrarCambios	BIT			= 1,	-- (1)- MOSTRAR SOLAMENTE LAS REGLAS QUE HAN SIDO MODIFICADAS, (0)- MOSTRAR TODAS LAS REGLAS
    @sCampOrderBy		VARCHAR(16) = NULL,
	@sDir				VARCHAR(6)	= NULL,
	@bHeaderRep			BIT			= 0
AS
BEGIN
	
	SET NOCOUNT ON;
	
	SELECT  *
	FROM	saReglaInt
	WHERE 
		--Filtro de codigo de regla de integracion
		(
			(@sCo_reg_d IS NULL OR @sCo_reg_d <= co_reg) 
			AND 
			(@sCo_reg_h IS NULL OR co_reg <= @sCo_reg_h)
		) 

		--Filtro de Mostrar Cambios
		AND 
		(
			(
				@bMostrarCambios = 1 
				AND 
				(fe_us_in <> fe_us_mo)
			) 
			OR 
			(@bMostrarCambios = 0)
		)
		
	ORDER BY co_reg
END
```
