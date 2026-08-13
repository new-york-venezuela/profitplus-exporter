# SP: pActualizarDiferenciaDocumentoFiscal
**Tipo**: Actualizar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pActualizarDiferenciaDocumentoFiscal
*DESCRIPCIÓN	: Actualiza el Documento de Venta Factura - N/CR con la diferencia entre la impresora y el sistema
*AUTOR			: SOFTECH SISTEMAS
*FECHA CREACION : 2019-06-14
*FECHA MODIFICA : 2019-06-14
*************************************************************************/
CREATE PROCEDURE [dbo].[pActualizarDiferenciaDocumentoFiscal] 
( 
   @sTipo_Doc CHAR(4),
   @sDoc_Num CHAR(20),
   @Diferencia DECIMAL(18,2)
)
AS 
    BEGIN
		IF @sTipo_Doc = 'FACT'
		BEGIN
			update saFacturaVenta set otros3=@Diferencia, total_neto=total_neto+@Diferencia, saldo=saldo+@Diferencia where doc_num=@sDoc_Num
		END
		ELSE
		BEGIN
			update saDevolucionCliente set otros3=@Diferencia, total_neto=total_neto+@Diferencia, saldo=saldo+@Diferencia where doc_num=@sDoc_Num
		END
		update saDocumentoVenta set otros3=@Diferencia, total_neto=total_neto+@Diferencia, saldo=saldo+@Diferencia where co_tipo_doc=@sTipo_Doc AND nro_orig=@sDoc_Num
	END
```
