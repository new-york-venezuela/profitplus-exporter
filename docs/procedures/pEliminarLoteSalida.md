# SP: pEliminarLoteSalida
**Tipo**: Eliminar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjuste`](../tables/saAjuste.md)
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saDevolucionProveedor`](../tables/saDevolucionProveedor.md)
- [`saDevolucionProveedorReng`](../tables/saDevolucionProveedorReng.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saLoteSalida`](../tables/saLoteSalida.md)
- [`saNotaEntregaVenta`](../tables/saNotaEntregaVenta.md)
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)
- [`saTipoAjuste`](../tables/saTipoAjuste.md)
- [`saTraslado`](../tables/saTraslado.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pEliminarLoteSalida]
    (
      @gRowguid UNIQUEIDENTIFIER ,
      @sTipo_Doc CHAR(4)
    )
AS 
    BEGIN
        DECLARE @iCantidadRenglones INT
        DECLARE @MensajeError VARCHAR(256)
        DECLARE @RowIdsHijo TABLE
            (
              [ROWGUID] [uniqueidentifier]
            )		

        IF ( @sTipo_Doc = 'AJUS' ) 
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
        IF ( @sTipo_Doc = 'TRAS' ) 
            BEGIN
                INSERT  INTO @RowIdsHijo
                        SELECT
                            R.rowguid
                        FROM
                            saTraslado t
                            INNER JOIN saTrasladoReng R ON R.tras_num = t.tras_num
                        WHERE
                            t.rowguid = @gRowguid
            END
		
        IF ( @sTipo_Doc = 'FACT' ) 
            BEGIN
                INSERT  INTO @RowIdsHijo
                        SELECT
                            R.rowguid
                        FROM
                            saFacturaVenta FV
                            INNER JOIN saFacturaVentaReng R ON R.doc_num = FV.doc_num
                        WHERE
                            FV.rowguid = @gRowguid
            END
        IF ( @sTipo_Doc = 'NENT' ) 
            BEGIN
                INSERT  INTO @RowIdsHijo
                        SELECT
                            R.rowguid
                        FROM
                            saNotaEntregaVenta NEV
                            INNER JOIN saNotaEntregaVentaReng R ON R.doc_num = NEV.doc_num
                        WHERE
                            NEV.rowguid = @gRowguid
            END
        IF ( @sTipo_Doc = 'DPRO' ) 
            BEGIN
                INSERT  INTO @RowIdsHijo
                        SELECT
                            R.rowguid
                        FROM
                            saDevolucionProveedor DP
                            INNER JOIN saDevolucionProveedorRe
```
