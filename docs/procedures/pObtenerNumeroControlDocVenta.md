# SP: pObtenerNumeroControlDocVenta
**Tipo**: Obtener
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerNumeroControlDocVenta]
DESCRIPCION: Obtener el numero de control de un documento de venta
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerNumeroControlDocVenta]
    (
      @sN_Control CHAR(20) ,
      @sTipoDocumento CHAR(6)
    )
AS 
    BEGIN	

        SELECT
            nro_doc
        FROM
            dbo.saDocumentoVenta
        WHERE
            N_Control = @sN_Control
            AND co_tipo_doc = @sTipoDocumento
	
    END
```
