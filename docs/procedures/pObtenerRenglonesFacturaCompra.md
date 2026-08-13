# SP: pObtenerRenglonesFacturaCompra
**Tipo**: Obtener
**Módulo**: Compras

## Tablas Referenciadas
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <08/12/2011>
-- Description:	<Obtiene los renglones de la factura de compra>
-- =============================================
CREATE PROCEDURE [pObtenerRenglonesFacturaCompra]
    (
      @sDoc_Num CHAR(20)
    )
AS 
    BEGIN
      
      SELECT reng_num, doc_num, co_art, co_alma, reng_neto, porc_imp, monto_imp, monto_desc_glob, monto_reca_glob FROM saFacturaCompraReng WHERE doc_num = @sDoc_Num
  
    END
```
