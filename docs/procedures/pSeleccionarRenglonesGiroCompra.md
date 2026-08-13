# SP: pSeleccionarRenglonesGiroCompra
**Tipo**: Seleccionar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saGiroCompraReng`](../tables/saGiroCompraReng.md)
- [`saPagoDocReng`](../tables/saPagoDocReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarCheque
DESCRIPCION: Procedimiento para seleccionar todos los cheques asociados a una chequera
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarRenglonesGiroCompra] ( @sCo_Giro CHAR(20) )
AS 
    BEGIN
        SELECT
            Gc.*, Dc.fec_Emis, Dc.fec_venc, Dc.co_Mone, tasa, dc.saldo  as saldo, dc.total_neto, ISNULL((SELECT SUM(mont_cob) FROM saPagoDocReng WHERE nro_doc= GC.nro_doc),0) AS pagos_anteriores
        FROM
            saGiroCompraReng AS Gc
            INNER JOIN saDocumentoCompra Dc ON Dc.Nro_Doc = Gc.Nro_Doc
                                               AND Dc.co_tipo_doc = Gc.co_tipo_Doc
        WHERE
            co_giro = @sCo_Giro

    END
```
