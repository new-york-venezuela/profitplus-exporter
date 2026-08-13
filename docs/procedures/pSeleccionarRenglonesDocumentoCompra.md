# SP: pSeleccionarRenglonesDocumentoCompra
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saDocumentoCompraReng`](../tables/saDocumentoCompraReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pSeleccionarRenglonesDocumentoCompra
DESCRIPCION	: Selecciona un registro de la tabla saDocumentCompraReng
CREADO POR	: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarRenglonesDocumentoCompra]
    (
      @sNro_Doc CHAR(20) ,
      @sCo_Tipo_Doc CHAR(6)
    )
AS 
    BEGIN

        SELECT
            dc.*, a.art_des
        FROM
            saDocumentoCompraReng dc
            LEFT JOIN saArticulo a ON ( dc.co_art = a.co_art )
        WHERE
            nro_doc = @sNro_Doc
            AND co_tipo_doc = @sCo_Tipo_Doc
        ORDER BY
            reng_num ASC

    END
```
