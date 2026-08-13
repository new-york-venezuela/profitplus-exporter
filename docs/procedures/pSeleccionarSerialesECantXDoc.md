# SP: pSeleccionarSerialesECantXDoc
**Tipo**: Seleccionar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saAjuste`](../tables/saAjuste.md)
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saDevolucionProveedor`](../tables/saDevolucionProveedor.md)
- [`saDevolucionProveedorReng`](../tables/saDevolucionProveedorReng.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saNotaDespachoVenta`](../tables/saNotaDespachoVenta.md)
- [`saNotaDespachoVentaReng`](../tables/saNotaDespachoVentaReng.md)
- [`saNotaEntregaVenta`](../tables/saNotaEntregaVenta.md)
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)
- [`saNotaRecepcionCompra`](../tables/saNotaRecepcionCompra.md)
- [`saNotaRecepcionCompraReng`](../tables/saNotaRecepcionCompraReng.md)
- [`saSeriales`](../tables/saSeriales.md)
- [`saTraslado`](../tables/saTraslado.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
-- ================================================================================================
-- Author:		SOFTECH SISTEMAS
-- Modificado:	SOFTECH SISTEMAS
-- Create date: 19/05/2010
-- Description:	SP que indica si alguno de los renglones del documento 
-- posee seriales
-- ================================================================================================

CREATE PROCEDURE [pSeleccionarSerialesECantXDoc]
    @sTipo_Doc CHAR(4) ,
    @gRowguid UNIQUEIDENTIFIER = NULL -- Identificador del documento padre
AS 
    BEGIN
        IF @sTipo_Doc = 'AJUS' 
            BEGIN
                SELECT
                    ISNULL(COUNT(*), 0) AS cantidad
                FROM
                    saSeriales
                WHERE
                    doc_tip_e = @sTipo_Doc
                    AND doc_num_e IN ( SELECT
                                        rowguid
                                       FROM
                                        saajustereng
                                       WHERE
                                        ajue_num IN ( SELECT
                                                        ajue_num
                                                      FROM
                                                        saajuste
                                                      WHERE
                                                        rowguid = @gRowguid ) )
            END
	
        ELSE 
            IF @sTipo_Doc = 'TRAS' 
                BEGIN
                    SELECT
                        ISNULL(COUNT(*), 0) AS cantidad
                    FROM
                        saSeriales
                    WHERE
                        doc_tip_s = @sTipo_Doc
                        AND doc_num_s IN ( -- Selecciono seriales cuyo Id coincida con alguno de los id del documento
                        SELECT
                            rowguid
                        FROM
                            saTrasladoReng
                        WHERE
                            tras_num IN (-- Busco rowid de los hijos del documento padre
                            SELECT
                                tras_num
                            FROM
                                saTraslado
                            WHERE
                                rowguid = @gRowguid ) )
                END
	
            ELSE 
                IF @sTipo_Doc = 'COMP' 
                    BEGIN
```
