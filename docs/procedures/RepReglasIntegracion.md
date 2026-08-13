# SP: RepReglasIntegracion
**Tipo**: Reporte
**Módulo**: General

## Tablas Referenciadas
- [`saReglaInt`](../tables/saReglaInt.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		<SOFTECH CONSULTORES C.A.>
-- Create date: 31-01-2017
-- Description:	Reporte que lista la versión
--				actual de las reglas de 
--				integración del sistema.
-- =============================================
CREATE PROCEDURE [dbo].[RepReglasIntegracion]
	-- Add the parameters for the stored procedure here
	@sCo_reg_d		VARCHAR(10) = NULL,
	@sCo_reg_h		VARCHAR(10) = NULL,
	@sTipo			VARCHAR(4)	= NULL,
	@bImp_Aplica	BIT			= 1,
	@bImp_Monto		BIT			= 1,
	@bImp_Gasto		BIT			= 1,
	@bImp_Costo		BIT			= 1,	
	@bImp_Descrip	BIT			= 1,	
	@bImp_Cuenta	BIT			= 1,
    @sCampOrderBy	VARCHAR(16) = NULL,
	@sDir			VARCHAR(6)	= NULL,
	@bHeaderRep		BIT			= 0
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

    -- Insert statements for procedure here
SELECT  co_reg, des_reg, tipo, debehaber, aplica, monto, gasto, distri, descrip, cuenta
FROM	saReglaInt
WHERE (
		(@sCo_reg_d IS NULL OR @sCo_reg_d <= co_reg) 
		AND 
		(@sCo_reg_h IS NULL OR co_reg <= @sCo_reg_h)
	  ) 
	  AND 
	  (
		  @sTipo IS NULL 
		  OR 
		  LEFT(tipo,4) = LEFT(@sTipo,4)
	  )
ORDER BY co_reg
END
```
