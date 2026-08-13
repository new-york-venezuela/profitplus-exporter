# SP: pObtenerNroDocumentoGiroVenta
**Tipo**: Obtener
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
/*******************************************************************************************************************
*NOMBRE			: [pObtenerNroDocumentoGiroVenta]
*DESCRIPCIÓN	: obtiene el numero de documento asociado a uno giro
*AUTOR			: SOFTECH SISTEMAS
*FECHA			: 2010-05-25
*******************************************************************************************************************/

CREATE PROCEDURE [pObtenerNroDocumentoGiroVenta]
    (
      @sDoc_Orig CHAR(20) ,
      @sCo_Tipo_Doc CHAR(4)
    )
AS 
    BEGIN	

        SELECT
            nro_doc
        FROM
            saDocumentoVenta
        WHERE
            nro_orig = @sDoc_Orig
            AND co_tipo_doc = @sCo_Tipo_Doc
    END
```
