# SP: pValidarFacturaRegistrada
**Tipo**: Validar
**Módulo**: Compras

## Tablas Referenciadas
- [`saFacturaCompra`](../tables/saFacturaCompra.md)

## Código (excerpt)
```sql
/**********************************************************************************************
*DESCRIPCION	:	Verifica si existe un numero de factura repetido por proveedor
*AUTOR			:	SOFTECH SISTEMAS
*FECHA			:	29/07/2010
***********************************************************************************************/
CREATE PROCEDURE [pValidarFacturaRegistrada]
    (
      @sCodigoProveedor CHAR(6) ,
      @sNumerofactura VARCHAR(20)
    )
AS 
    BEGIN
		
        DECLARE @bExisteFactura AS BIT
		
        IF EXISTS ( SELECT
                        *
                    FROM
                        saFacturaCompra
                    WHERE
                        nro_fact = @sNumerofactura
                        AND co_prov = @sCodigoProveedor ) 
            SET @bExisteFactura = 1
        ELSE 
            SET @bExisteFactura = 0
			
        SELECT
            @bExisteFactura AS existeFactura
		
    END
```
