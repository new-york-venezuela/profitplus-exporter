# SP: pCodigoNCFDesdeSerie
**Tipo**: Procedimiento
**Módulo**: General

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <27/05/2019>
-- Description:	Obtener el código completo del Serial a partir de la Serie, Sucursal y Empresa
-- =============================================
--EXEC pCodigoNCFDesdeSerie 'TC14-1', 'NCF_A201904', '01'
CREATE PROCEDURE [dbo].[pCodigoNCFDesdeSerie]
    (
		@sCo_Serie VARCHAR(16),
		@sCo_emp VARCHAR(20),
		@sCo_sucur VARCHAR(6)
    )
AS 
    BEGIN
		SET NOCOUNT ON;
		
		SELECT co_consecutivo FROM v_saSeriesNCF
			WHERE Serie = @sCo_Serie AND ((Usoempresa = 1 AND co_emp = @sCo_emp) 
			OR (UsoSucursal = 1 AND co_sucur = @sCo_sucur))
    END
```
