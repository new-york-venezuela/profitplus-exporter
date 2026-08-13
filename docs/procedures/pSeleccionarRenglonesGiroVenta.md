# SP: pSeleccionarRenglonesGiroVenta
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCobroDocReng`](../tables/saCobroDocReng.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saGiroVentaReng`](../tables/saGiroVentaReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarCheque
DESCRIPCION: Procedimiento para seleccionar todos los cheques asociados a una chequera
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarRenglonesGiroVenta] ( @sCo_Giro CHAR(20) )
AS 
    BEGIN
        SELECT
            GV.*, DV.fec_Emis, DV.fec_venc, DV.co_Mone, tasa, DV.total_neto as saldo, DV.total_neto, ISNULL((select sum(mont_cob) from saCobroDocReng where nro_doc= GV.nro_doc),0) AS cobros_anteriores
        FROM
            saGiroVentaReng AS GV
            INNER JOIN saDocumentoVenta DV ON DV.Nro_Doc = GV.Nro_Doc
                                              AND DV.co_tipo_doc = GV.co_tipo_Doc
        WHERE
            co_giro = @sCo_Giro

    END
```
