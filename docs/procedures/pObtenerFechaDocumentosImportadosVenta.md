# SP: pObtenerFechaDocumentosImportadosVenta
**Tipo**: Obtener
**Módulo**: Ventas

## Tablas Referenciadas
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saNotaDespachoVenta`](../tables/saNotaDespachoVenta.md)
- [`saNotaEntregaVenta`](../tables/saNotaEntregaVenta.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerFechaDocumentosImportados]
DESCRIPCION: Obtiene la lista de las fechas de documentos importados
CREADO POR: SOFTECH SISTEMAS
FECHA CREACION: 25-04-2011
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerFechaDocumentosImportadosVenta]
    (
      @bEsFact BIT = NULL,
      @sNumDoc VARCHAR(20)
    )
AS 
    BEGIN		
		
        IF ( @bEsFact IS NULL ) 
            SELECT
                fec_emis
            FROM
                saNotaDespachoVenta
            WHERE
                doc_Num = @sNumDoc
		
        IF ( @bEsFact = 1 ) 
            SELECT
                fec_emis
            FROM
                saFacturaVenta
            WHERE
                doc_Num = @sNumDoc

		IF ( @bEsFact = 0 ) 
            SELECT
                fec_emis
            FROM
                saNotaEntregaVenta
            WHERE
                doc_Num = @sNumDoc
    END
```
