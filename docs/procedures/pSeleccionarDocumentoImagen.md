# SP: pSeleccionarDocumentoImagen
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)

## Código (excerpt)
```sql
-- =============================================
-- NOMBRE:			pSeleccionarDocumentoImagen
-- DESCRIPCIÓN:		Selecciona la imagen de un documento
-- AUTOR:			SOFTECH CONSULTORES
-- =============================================
CREATE PROCEDURE [dbo].[pSeleccionarDocumentoImagen]
	(	  
	  @gRowguidDoc UNIQUEIDENTIFIER,
	  @sCo_imag CHAR(6)
	)
AS
	BEGIN
		SELECT
            DI.*
        FROM
            saDocumentoImagen DI
        WHERE            
            DI.rowguidDoc = @gRowguidDoc
			AND DI.co_imag = @sCo_imag
	END
```
