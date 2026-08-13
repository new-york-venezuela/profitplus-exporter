# SP: pObtenerConfigArtImportacion
**Tipo**: Obtener
**Módulo**: General

## Tablas Referenciadas
- [`saArtImportacion`](../tables/saArtImportacion.md)

## Código (excerpt)
```sql
/*******************************************************************************************************************
*NOMBRE			: [pObtenerConfigArtImportacion]
*DESCRIPCIÓN	: Sp que obtiene la configuración de importación del Artículo
*AUTOR			: SOFTECH SISTEMAS
*******************************************************************************************************************/ 

CREATE PROCEDURE [dbo].[pObtenerConfigArtImportacion]
     (
		@sCo_Art CHAR(30) 
     )
AS 
    BEGIN
		
		DECLARE @sCalculo VARCHAR(1)

		SELECT @sCalculo = calculo
		FROM saArtImportacion
		WHERE co_art = @sCo_Art

			IF (@sCalculo IS NULL)
				BEGIN

				SET @sCalculo = ''

				END

		SELECT @sCalculo AS Calculo

    END
```
