# SP: pObtenerDocumentoVentaNCF
**Tipo**: Obtener
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saNCFInfoDocVenta`](../tables/saNCFInfoDocVenta.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerDocumentoVentaNCF]
DESCRIPCION: Obtener Documentos de Ventas NCF
FECHA CREACIÓN: <2019-05-28>
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerDocumentoVentaNCF]
	(
      @sCo_Tipo_Doc CHAR(6) ,
      @sNro_Doc CHAR(20)
    )
AS
BEGIN
	SELECT
            DV.co_tipo_doc, DV.nro_doc, NCF.ncf as NumeroControlFiscal
        FROM
            saDocumentoVenta DV            
			LEFT JOIN saNCFInfoDocVenta NCF ON NCF.nro_doc = DV.nro_doc AND NCF.tipo_doc = DV.co_tipo_doc			
        WHERE
            DV.co_tipo_doc = @sCo_Tipo_Doc AND DV.nro_doc = @sNro_Doc
        ORDER BY
            DV.co_tipo_doc, DV.nro_doc
END
```
