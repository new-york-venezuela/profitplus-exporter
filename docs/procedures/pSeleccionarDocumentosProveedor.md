# SP: pSeleccionarDocumentosProveedor
**Tipo**: Seleccionar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pSeleccionarDocumentosProveedor
DESCRIPCION	: Seleccionar los documentos de un proveedor
CREADO POR	: SOFTECH SISTEMAS
CREADO EL	: 25/02/2010
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarDocumentosProveedor]
    (
      @sCodigo CHAR(16) ,
      @bPendiente BIT ,
      @sMoneda CHAR(6) = NULL
	
    )
AS 
    BEGIN
	--No se toman en cuenta los documentos anulados

        IF ( @bPendiente = 1 ) --Se devuelven solo los documentos pendientes (Saldo > 0)
            SELECT
                *
            FROM
                saDocumentoCompra
            WHERE
                anulado = 0
                AND co_prov = @sCodigo
                AND saldo > 0
                AND ( co_mone = @sMoneda
                      OR @sMoneda IS NULL
                      OR @sMoneda = ''
                    )
		
        ELSE --Se devuelven todos los documentos del proveedor
            SELECT
                *
            FROM
                saDocumentoCompra
            WHERE
                anulado = 0
                AND co_prov = @sCodigo
                AND ( co_mone = @sMoneda
                      OR @sMoneda IS NULL
                      OR @sMoneda = ''
                    )
	
    END
```
