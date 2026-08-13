# SP: pValidarExistenciaNroControl
**Tipo**: Validar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
-- =============================================
-- Author		: SOFTECH SISTEMAS
-- Create date	: 2020-01-07
-- Modified date: 2020-01-07
-- Description	: Valida si el número de control ya existe
-- =============================================
CREATE PROCEDURE [dbo].[pValidarExistenciaNroControl]
    (
      @sTipoDoc CHAR(6) ,
      @sNroControl CHAR(20)
    )
AS 
    BEGIN	
		DECLARE @bExiste BIT

		IF EXISTS (
				SELECT
					dv.n_control
				FROM saDocumentoVenta dv
				WHERE dv.co_tipo_doc = @sTipoDoc
					AND dv.n_control = @sNroControl
			)
			SET @bExiste = 1
		ELSE
			SET @bExiste = 0

		SELECT @bExiste AS Existe
	
    END
```
