# SP: pExisteGeneracionCompuesto
**Tipo**: Procedimiento
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtCompuesto`](../tables/saArtCompuesto.md)
- [`saArtCompuestoGen`](../tables/saArtCompuestoGen.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		<Softech Consultores C.A.>
-- Create date: <22-02-2017>
-- Description:	<Determina si un artículo compuesto 
-- ha sido generado al menos una vez>
-- =============================================
CREATE PROCEDURE [dbo].[pExisteGeneracionCompuesto]
	@sCo_Art CHAR(30)
AS
BEGIN	
	SET NOCOUNT ON;
	SELECT 
		CAST(
			CASE WHEN 
				EXISTS(
					SELECT AC.rowguid 
					FROM saArtCompuesto		AS AC JOIN 
						 saArtCompuestoGen  AS AG ON AC.co_art = AG.co_art 
					WHERE AC.co_art = @sCo_Art
				      ) 
				THEN 1 
				ELSE 0 
				END AS BIT
			) AS existe
END
```
