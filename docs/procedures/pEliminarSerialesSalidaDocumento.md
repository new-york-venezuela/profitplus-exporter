# SP: pEliminarSerialesSalidaDocumento
**Tipo**: Eliminar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saAjuste`](../tables/saAjuste.md)
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saDevolucionProveedor`](../tables/saDevolucionProveedor.md)
- [`saDevolucionProveedorReng`](../tables/saDevolucionProveedorReng.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saNotaDespachoVenta`](../tables/saNotaDespachoVenta.md)
- [`saNotaDespachoVentaReng`](../tables/saNotaDespachoVentaReng.md)
- [`saNotaEntregaVenta`](../tables/saNotaEntregaVenta.md)
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)
- [`saSeriales`](../tables/saSeriales.md)
- [`saTipoAjuste`](../tables/saTipoAjuste.md)
- [`saTraslado`](../tables/saTraslado.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
/******************************************************************
*NOMBRE			:	[pEliminarSerialesSalidaDocumento]
*DESCRIPCIÓN	:	Elimina un registro en la tabla  seriales
*AUTOR			:	SOFTECH SISTEMAS
******************************************************************/

CREATE PROCEDURE [pEliminarSerialesSalidaDocumento]
    (
      @sTipo_Doc CHAR(4) ,
      @gRowguid UNIQUEIDENTIFIER = NULL -- Id del documento que representa la entrada del serial

    )
AS 
    BEGIN
        DECLARE @RowIdsHijo TABLE
            (
              [ROWGUID] [uniqueidentifier]
            )		

        IF ( @sTipo_Doc = 'AJUS' ) --AJUSTE
            BEGIN
                INSERT  INTO @RowIdsHijo
                        SELECT
                            R.rowguid
                        FROM
                            saAjuste E
                            INNER JOIN saAjusteReng R ON R.ajue_num = E.ajue_num
                            INNER JOIN saTipoAjuste T ON R.co_tipo = T.co_tipo
                        WHERE
                            E.rowguid = @gRowguid
                            AND t.tipo_trans = 1
            END
		
        IF ( @sTipo_Doc = 'TRAS' ) -- TRASLADO
            BEGIN
		
                INSERT  INTO @RowIdsHijo
                        SELECT
                            R.rowguid
                        FROM
                            saTraslado E
                            INNER JOIN saTrasladoReng R ON R.tras_num = E.tras_num
                        WHERE
                            E.rowguid = @gRowguid

            END
		
        IF ( @sTipo_Doc = 'DPRO' ) -- DEVOLUCION PROVEEDOR
            BEGIN
		
                INSERT  INTO @RowIdsHijo
                        SELECT
                            R.rowguid
                        FROM
                            saDevolucionProveedor E
                            INNER JOIN saDevolucionProveedorReng R ON R.doc_num = E.doc_num
                        WHERE
                            E.rowguid = @gRowguid

            END
		
        IF ( @sTipo_Doc = 'FACT' ) -- FACTURA DE VENTA
            BEGIN
		
                INSERT  INTO @RowIdsHijo
                        SELECT
                            R.rowguid
                        FROM
                            saFacturaVenta E
                            INNER JOIN saFacturaVentaReng R ON R.doc_num = E.doc_num
                        WHERE
                            E.ro
```
