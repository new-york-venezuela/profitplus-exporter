# SP: pObtenerFechaDocumentosImportadosCompra
**Tipo**: Obtener
**Módulo**: Compras

## Tablas Referenciadas
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saNotaRecepcionCompra`](../tables/saNotaRecepcionCompra.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerFechaDocumentosImportados]
DESCRIPCION: Obtiene la lista de las fechas de documentos importados
CREADO POR: Softech Sistemas.
FECHA CREACION: 25-04-2011
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerFechaDocumentosImportadosCompra]
    (
      @bEsFact BIT ,
      @sNumDoc VARCHAR(20)
    )
AS 
    BEGIN		
	
        IF ( @bEsFact = 1 ) 
            SELECT
                fec_emis
            FROM
                saFacturaCompra
            WHERE
                doc_Num = @sNumDoc
        IF ( @bEsFact = 0 ) 
            SELECT
                fec_emis
            FROM
                saNotaRecepcionCompra
            WHERE
                doc_Num = @sNumDoc
    END
```
