# SP: pValidarExistenciaNumeroFacturaFiscal
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
-- Description	: Valida si el número fiscal de la factura existe
-- =============================================
CREATE PROCEDURE [dbo].[pValidarExistenciaNumeroFacturaFiscal]
    (
      @sNumeroFiscal CHAR(20),
	   @sTipoDocumento CHAR(20)
    )
AS 
    BEGIN	
		DECLARE @bExiste BIT

		IF EXISTS (
				
					SELECT impfisfac FROM sadocumentoventa WHERE 
                    co_tipo_doc = @sTipoDocumento AND  impfisfac = @sNumeroFiscal
                   
			)
			SET @bExiste = 1
		ELSE
			SET @bExiste = 0

		SELECT @bExiste AS Existe
	
    END
```
