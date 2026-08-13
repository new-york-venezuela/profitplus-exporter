# SP: pOrigenPv
**Tipo**: Procedimiento
**Módulo**: Tesorería

## Tablas Referenciadas
- [`pvCobroExt`](../tables/pvCobroExt.md)
- [`pvDevolucionClienteExt`](../tables/pvDevolucionClienteExt.md)
- [`pvFacturaVentaExt`](../tables/pvFacturaVentaExt.md)
- [`pvMovimientoCajaExt`](../tables/pvMovimientoCajaExt.md)
- [`saCobro`](../tables/saCobro.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pOrigenPv
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pOrigenPv] 
@sNum_doc char (20),
@sTipo_doc char (6)

AS 
BEGIN

       Declare @Id uniqueidentifier

       If @sTipo_doc = 'VFAC'
       Begin
             SELECT @Id = rowguid
                    FROM saFacturaVenta
                    WHERE doc_num = @sNum_doc

             IF (@Id is not null)
                    SELECT  rowguid_doc_num from pvFacturaVentaExt
                           WHERE rowguid_doc_num = @Id
       END

       If @sTipo_doc = 'DEVC'
       Begin
             SELECT @Id = rowguid
                    FROM saDevolucionCliente
                    WHERE doc_num = @sNum_doc

             IF (@Id is not null)
                    SELECT  rowguid_doc_num from pvDevolucionClienteExt
                           WHERE rowguid_doc_num = @Id
       End

       If @sTipo_doc = 'MOVC'
       Begin
             SELECT @Id = rowguid
                    FROM saMovimientoCaja
                    WHERE mov_num = @sNum_doc

             IF (@Id is not null)
                    SELECT  rowguid_mov_num from pvMovimientoCajaExt
                           WHERE rowguid_mov_num = @Id
       End

       If @sTipo_doc = 'COBR'
       Begin
             SELECT @Id = rowguid
                    FROM saCobro
                    WHERE cob_num = @sNum_doc

             IF (@Id is not null)
                    SELECT  rowguid_cob_num from pvCobroExt
                           WHERE rowguid_cob_num = @Id
       End
    END
```
