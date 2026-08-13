# SP: pStockPendienteActualizar
**Tipo**: Procedimiento
**Módulo**: Compras

## Tablas Referenciadas
- [`saCotizacionClienteReng`](../tables/saCotizacionClienteReng.md)
- [`saCotizacionProveedorReng`](../tables/saCotizacionProveedorReng.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saDevolucionProveedorReng`](../tables/saDevolucionProveedorReng.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saNotaDespachoVentaReng`](../tables/saNotaDespachoVentaReng.md)
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)
- [`saNotaRecepcionCompraReng`](../tables/saNotaRecepcionCompraReng.md)
- [`saOrdenCompraReng`](../tables/saOrdenCompraReng.md)
- [`saPedidoVentaReng`](../tables/saPedidoVentaReng.md)
- [`saPlantillaCompraReng`](../tables/saPlantillaCompraReng.md)
- [`saPlantillaVentaReng`](../tables/saPlantillaVentaReng.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pStockPendienteActualizar]
*DESCRIPCIÓN	: actualiza los pendientes en los renglones de documentos de compra o venta
*AUTOR			: SOFTECH SISTEMAS
*FECHA			: 2010-07-01
**************************************************************************/

CREATE PROCEDURE [pStockPendienteActualizar]
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
              pendienteFinal DECIMAL(18, 5) ,
              devuelto DECIMAL(18, 5) ,
              reng_num INT ,
              doc_num CHAR(20)
            )
			
        DECLARE @intResultado INTEGER
        DECLARE @PendienteFinal DECIMAL(18, 5)
        DECLARE @Devuelto DECIMAL(18, 5)
        DECLARE @Reng_Num INT
        DECLARE @Doc_Num CHAR(20)

        IF @sTipoDocumento = 'FACT' 
            BEGIN
                UPDATE
                    saFacturaVentaReng
                SET pendiente = pendiente - @deCantidad
                OUTPUT
                    inserted.pendiente, inserted.total_dev, inserted.reng_num, inserted.doc_num
                    INTO @TableResult
                WHERE
                    rowguid = @uniRowGuidOri
                SELECT TOP 1
                    @PendienteFinal = pendienteFinal, @Reng_Num = reng_num, @Doc_Num = doc_num
                FROM
                    @TableResult
                EXEC [dbo].[pValidarStatusFacturaVenta] @nroDoc = @Doc_Num
            END
        ELSE 
            IF @sTipoDocumento = 'NENT' 
                BEGIN
                    UPDATE
                        dbo.saNotaEntregaVentaReng
                    SET pendiente = pendiente - @deCantidad
                    OUTPUT
                        inserted.pendiente, inserted.total_dev, inserted.reng_num, inserted.doc_num
                        INTO @TableResult
                    WHERE
                        rowguid = @uniRowGuidOri
                    SELECT TOP 1
                        @PendienteFinal = pendienteFinal, @Reng_Num = reng_num, @Doc_Num = doc_num
                    FROM
                        @TableResult
                    EXEC [dbo].[pValidarStatusNotaEntregaVenta] @nroDoc = @Doc_Num
                END
            ELSE 
                IF @sTipoDocumento = 'DC
```
