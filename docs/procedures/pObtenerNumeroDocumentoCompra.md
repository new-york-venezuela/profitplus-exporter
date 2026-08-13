# SP: pObtenerNumeroDocumentoCompra
**Tipo**: Obtener
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerNumeroDocumentoCompra]
DESCRIPCION: Obtener el numero de un documento de compra a partir de un tipo y numero de origen
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerNumeroDocumentoCompra]
    (
      @sDoc_Orig CHAR(6) ,
      @sNro_Orig CHAR(20)
    )
AS 
    BEGIN	

        SELECT
            nro_doc
        FROM
            dbo.saDocumentoCompra
        WHERE
            Doc_Orig = @sDoc_Orig
            AND Nro_Orig = @sNro_Orig
	
    END
```
