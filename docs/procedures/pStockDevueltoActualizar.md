# SP: pStockDevueltoActualizar
**Tipo**: Procedimiento
**Módulo**: Compras

## Tablas Referenciadas
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saNotaDespachoVentaReng`](../tables/saNotaDespachoVentaReng.md)
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)
- [`saNotaRecepcionCompraReng`](../tables/saNotaRecepcionCompraReng.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pStockDevueltoActualizar]
*DESCRIPCIÓN	: Actualiza los devueltos en los renglones de documentos de compra o venta
*AUTOR			: SOFTECH SISTEMAS
*FECHA			: 2010-07-28
**************************************************************************/

CREATE PROCEDURE [pStockDevueltoActualizar]
    (
      @uniRowGuidOri UNIQUEIDENTIFIER ,
      @deCantidad DECIMAL(18, 5) ,
      @sTipoDocumento CHAR(4)
    )
AS 
    BEGIN     
       
        DECLARE @MensajeError VARCHAR(256)
        DECLARE @TableResult TABLE
            (
              devueltoFinal DECIMAL(18, 5) ,
              total_art DECIMAL(18, 5) ,
              pendiente DECIMAL(18, 5) ,
              reng_num INT ,
              doc_num CHAR(20)
            )
              
        DECLARE @intResultado INTEGER
        DECLARE @DevueltoFinal DECIMAL(18, 5)
        DECLARE @Total_Art DECIMAL(18, 5)
        DECLARE @Pendiente DECIMAL(18, 5)
        DECLARE @Reng_Num INT
        DECLARE @Doc_Num CHAR(20)

        IF @sTipoDocumento = 'FACT' 
            BEGIN
				DECLARE @bAnuladoFV BIT
				DECLARE @sNroDocFV CHAR(20)

				SET @bAnuladoFV = (SELECT FV.anulado FROM saFacturaVentaReng FVR INNER JOIN saFacturaVenta FV ON FV.doc_num = FVR.doc_num WHERE FVR.rowguid = @uniRowGuidOri)
						
				IF @bAnuladoFV = 1
				BEGIN
					SET @sNroDocFV = (SELECT FV.doc_num FROM saFacturaVentaReng FVR INNER JOIN saFacturaVenta FV ON FV.doc_num = FVR.doc_num WHERE FVR.rowguid =@uniRowGuidOri)
					SET @MensajeError = 'El documento no puede ser alterado porque su documento de origen fue anulado. ' +
									' Revise el documento Factura de Venta Nro.: "' + RTRIM(@sNroDocFV) + 
									'" Operación pStockDevueltoActualizar' 
                    RAISERROR(@MensajeError,16,1)
                    RETURN ;
				END
				
                UPDATE
                    saFacturaVentaReng
                SET total_dev = total_dev + @deCantidad, pendiente = pendiente - @deCantidad
                OUTPUT
                    inserted.total_dev, inserted.total_art, inserted.pendiente, inserted.reng_num, inserted.doc_num
                    INTO @TableResult
                WHERE
                    rowguid = @uniRowGuidOri
            END
        ELSE 
            IF @sTipoDocumento = 'NENT' 
                BEGIN
                    UPDATE
                        saNotaEntregaVentaReng
```
