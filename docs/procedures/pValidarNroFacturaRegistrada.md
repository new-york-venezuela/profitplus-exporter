# SP: pValidarNroFacturaRegistrada
**Tipo**: Validar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)

## Código (excerpt)
```sql
/**********************************************************************************************
*NOMBRE			:	pValidarNroFacturaRegistrada
*DESCRIPCION	:	Verifica si existe un numero de factura repetido por proveedor
*AUTOR			:	SOFTECH SISTEMAS
*FECHA			:	29/07/2010
***********************************************************************************************/
CREATE PROCEDURE [dbo].[pValidarNroFacturaRegistrada]
    (
      @sCodigoProveedor CHAR(16) ,
      @sNumerofactura VARCHAR(20) ,
      @sTipoDocumento CHAR(4)
    )
AS 
    BEGIN
		
        DECLARE @bExisteFactura AS BIT
		
        IF EXISTS ( SELECT
                        *
                    FROM
                        saDocumentoCompra
                    WHERE
                        nro_fact = @sNumerofactura
                        AND co_prov = @sCodigoProveedor
                        AND co_tipo_doc = @sTipoDocumento
                        AND anulado = 0 ) 
            SET @bExisteFactura = 1
        ELSE 
            SET @bExisteFactura = 0
			
        SELECT
            @bExisteFactura AS existeFactura
		
    END
```
