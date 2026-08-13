# SP: pCostosEntradaSalidaReconstruir
**Tipo**: Procedimiento
**Módulo**: Ventas

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saAjuste`](../tables/saAjuste.md)
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saArtCompuestoGen`](../tables/saArtCompuestoGen.md)
- [`saArtCompuestoGenReng`](../tables/saArtCompuestoGenReng.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saDevolucionProveedor`](../tables/saDevolucionProveedor.md)
- [`saDevolucionProveedorReng`](../tables/saDevolucionProveedorReng.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saNotaEntregaVenta`](../tables/saNotaEntregaVenta.md)
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)
- [`saNotaRecepcionCompra`](../tables/saNotaRecepcionCompra.md)
- [`saNotaRecepcionCompraReng`](../tables/saNotaRecepcionCompraReng.md)
- [`saTipoAjuste`](../tables/saTipoAjuste.md)
- [`saTraslado`](../tables/saTraslado.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
/***************************************************************************************
*NOMBRE: pCostosEntradaSalidaReconstruir
*DESCRIPCIÓN : Reconstuir los Costos de Entrada y Salida para un tipo de documento
*AUTOR: SOFTECH SISTEMAS
****************************************************************************************/

CREATE PROCEDURE [pCostosEntradaSalidaReconstruir]
    (
      @sCodigoDoc CHAR(20) ,
      @sTipoDoc CHAR(4) ,
      @sTipoCosto CHAR(1) = NULL
    )
AS 
    BEGIN
        SET NOCOUNT OFF
        DECLARE @Id AS UNIQUEIDENTIFIER
        DECLARE @Anulado AS BIT
        DECLARE @isEntrada AS BIT
        DECLARE @tablaGenerica TABLE
            (
              rowguid UNIQUEIDENTIFIER ,
              anulado BIT ,
              isEntrada BIT
            )
	--DECLARE @tablaGenericaSalida TABLE (rowguid UNIQUEIDENTIFIER, anulado bit)
	
        IF @sTipoDoc = 'AJUS' --AJUSTES DE ENTRADA/SALIDA
            BEGIN
                INSERT  INTO @tablaGenerica
                        ( rowguid, anulado, isEntrada )
                        SELECT
                            saAjusteReng.rowguid, saAjuste.anulado, 1
                        FROM
                            saAjusteReng
                            INNER JOIN saAjuste ON saAjuste.ajue_num = saAjusteReng.ajue_num
                            INNER JOIN saTipoAjuste ON saAjusteReng.co_tipo = saTipoAjuste.co_tipo
                                                       AND saTipoAjuste.tipo_trans = '0'
                        WHERE
                            saAjusteReng.ajue_num = @sCodigoDoc
                        ORDER BY
                            saAjusteReng.reng_num

                INSERT  INTO @tablaGenerica
                        ( rowguid, anulado, isEntrada )
                        SELECT
                            saAjusteReng.rowguid, saAjuste.anulado, 0
                        FROM
                            saAjusteReng
                            INNER JOIN saAjuste ON saAjuste.ajue_num = saAjusteReng.ajue_num
                            INNER JOIN saTipoAjuste ON saTipoAjuste.co_tipo = saAjusteReng.co_tipo
                                                       AND saTipoAjuste.tipo_trans = '1'
                        WHERE
                            saAjusteReng.ajue_num = @sCodigoDoc
                        ORDER BY
                            saAjusteReng.reng_num
            END
        ELSE
```
