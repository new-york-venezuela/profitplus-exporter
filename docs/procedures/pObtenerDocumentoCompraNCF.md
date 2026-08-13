# SP: pObtenerDocumentoCompraNCF
**Tipo**: Obtener
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saNCFInfoDocCompra`](../tables/saNCFInfoDocCompra.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerDocumentoCompraNCF]
DESCRIPCION: Obtener Documentos de Compra NCF
FECHA CREACIÓN: <2019-05-28>
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerDocumentoCompraNCF]
    (
      @sCo_Tipo_Doc CHAR(6) ,
      @sNro_Doc CHAR(20)
    )
AS 
    BEGIN
       	
        SELECT
            DC.co_tipo_doc, DC.nro_doc, NCF.ncf as NumeroControlFiscal
        FROM
            saDocumentoCompra DC            
			LEFT JOIN saNCFInfoDocCompra NCF ON NCF.nro_doc = dc.nro_doc AND NCF.tipo_doc = dc.co_tipo_doc			
        WHERE
            DC.co_tipo_doc = @sCo_Tipo_Doc AND DC.nro_doc = @sNro_Doc
        ORDER BY
            DC.co_tipo_doc, DC.nro_doc
		
    END
```
