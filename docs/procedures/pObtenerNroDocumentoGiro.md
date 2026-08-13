# SP: pObtenerNroDocumentoGiro
**Tipo**: Obtener
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)

## Código (excerpt)
```sql
/*******************************************************************************************************************
*NOMBRE			: [pObtenerNroDocumentoGiro]
*DESCRIPCIÓN	: obtiene el numero de documento asociado a uno giro
*AUTOR			: SOFTECH SISTEMAS
*FECHA			: 2010-05-25
*******************************************************************************************************************/

CREATE PROCEDURE [pObtenerNroDocumentoGiro]
    (
      @sDoc_Orig CHAR(20) ,
      @sCo_Tipo_Doc CHAR(4)
    )
AS 
    BEGIN	

        SELECT
            nro_doc
        FROM
            saDocumentoCompra
        WHERE
            nro_orig = @sDoc_Orig
            AND co_tipo_doc = @sCo_Tipo_Doc
    END
```
