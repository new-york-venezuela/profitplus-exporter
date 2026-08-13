# SP: pSeleccionarRenglonesDocumentoVenta
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saDocumentoVentaReng`](../tables/saDocumentoVentaReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pSeleccionarRenglonesDocumentoVenta
DESCRIPCION	: Selecciona un registro de la tabla saDocumentoVentaReng
CREADO POR	: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarRenglonesDocumentoVenta]
    (
      @sNro_Doc CHAR(20) ,
      @sCo_Tipo_Doc CHAR(6)
    )
AS 
    BEGIN

        SELECT
            dv.*, a.art_des
        FROM
            saDocumentoVentaReng dv
            LEFT JOIN saArticulo a ON dv.co_art = a.co_art
        WHERE
            nro_doc = @sNro_Doc
            AND co_tipo_doc = @sCo_Tipo_Doc
        ORDER BY
            reng_num ASC
	
    END
```
