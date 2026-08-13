# SP: AnularAjustePositivoAutomatico
**Tipo**: Procedimiento
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: AnularAjustePositivoAutomatico
DESCRIPCION: Selecciona un registro de la tabla saDocumentoVenta segun sus claves primarias
CREADO POR: SOFTECH SISTEMAS
MODIFICADO POR: SOFTECH SISTEMAS (Se busca la fecha del cheque asociada al documento)
***************************************************************************************************************/ 
CREATE PROCEDURE [dbo].[AnularAjustePositivoAutomatico]
    (
	  @sNro_Doc CHAR(20),
	  @sTipo_Doc   CHAR(20)
    )
AS 
    BEGIN

		UPDATE saDocumentoVenta
			SET anulado = 1

		FROM saDocumentoVenta
		
		WHERE
            nro_doc = @sNro_Doc AND
			co_tipo_doc = @sTipo_Doc

    END
```
