# SP: pSeleccionarDocumentosCliente
**Tipo**: Seleccionar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pSeleccionarDocumentosCliente
DESCRIPCION	: Seleccionar los documentos de un Cliente
CREADO POR	: SOFTECH SISTEMAS
CREADO EL	: 26/02/2010
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarDocumentosCliente]
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
                co_tipo_doc, nro_doc, fec_emis, fec_venc, saldo, total_neto, total_bruto, monto_imp, co_cli, co_ven,
                co_mone, tasa
            FROM
                saDocumentoVenta
            WHERE
                anulado = 0
                AND co_cli = @sCodigo
                AND saldo > 0
                AND ( co_mone = @sMoneda
                      OR @sMoneda IS NULL
                      OR @sMoneda = ''
                    )
		
        ELSE --Se devuelven todos los documentos del proveedor
            SELECT
                co_tipo_doc, nro_doc, fec_emis, fec_venc, saldo, total_neto, total_bruto, monto_imp, co_cli, co_ven,
                co_mone, tasa
            FROM
                saDocumentoVenta
            WHERE
                anulado = 0
                AND co_cli = @sCodigo
                AND ( co_mone = @sMoneda
                      OR @sMoneda IS NULL
                      OR @sMoneda = ''
                    )
	
    END
```
