# SP: pSeleccionarDocumentoElectronico
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saDocumentoElectronico`](../tables/saDocumentoElectronico.md)

## Código (excerpt)
```sql
-- =============================================
-- NOMBRE:			pSeleccionarDocumentoElectronico
-- DEXCRIPCIÓN:		Obtiene el documento electrónico
-- AUTOR:			SOFTECH SISTEMAS
-- =============================================
CREATE PROCEDURE [dbo].[pSeleccionarDocumentoElectronico]
	( 
	  @sCo_doc_elec CHAR(20),
	  @sTipo_documento CHAR(10)	  
	)
AS
	BEGIN
			SELECT *
			FROM dbo.saDocumentoElectronico 
			WHERE co_doc_elec = @sCo_doc_elec AND tipo_documento = @sTipo_documento
	END
```
