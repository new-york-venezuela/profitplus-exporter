# SP: pObtenerDetalleDocumentoCompra
**Tipo**: Obtener
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompraReng`](../tables/saDocumentoCompraReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerDetalleDocumentoCompra]
DESCRIPCION: Obtiene el detalle de un documento de compra especifico
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerDetalleDocumentoCompra]
    (
      @sNro_Doc CHAR(20) ,
      @sCo_Tipo_Doc CHAR(6)
    )
AS 
    BEGIN
        SELECT
            *
        FROM
            saDocumentoCompraReng
        WHERE
            co_tipo_doc = @sCo_Tipo_Doc
            AND nro_doc = @sNro_Doc
    END
```
