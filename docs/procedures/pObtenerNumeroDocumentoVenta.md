# SP: pObtenerNumeroDocumentoVenta
**Tipo**: Obtener
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerNumeroDocumentoVenta]
DESCRIPCION: Obtener el numero de un documento de compra a partir de un tipo y numero de origen
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerNumeroDocumentoVenta]
    (
      @sDoc_Orig CHAR(6) ,
      @sNro_Orig CHAR(20)
    )
AS 
    BEGIN	

        SELECT
            nro_doc
        FROM
            dbo.saDocumentoVenta
        WHERE
            Doc_Orig = @sDoc_Orig
            AND Nro_Orig = @sNro_Orig
	
    END
```
