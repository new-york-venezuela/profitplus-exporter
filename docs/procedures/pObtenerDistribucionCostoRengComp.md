# SP: pObtenerDistribucionCostoRengComp
**Tipo**: Obtener
**Módulo**: Compras

## Tablas Referenciadas
- [`saDistribCosto`](../tables/saDistribCosto.md)
- [`saDistribCostoDestinoReng`](../tables/saDistribCostoDestinoReng.md)
- [`saDistribCostoRelaReng`](../tables/saDistribCostoRelaReng.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH CONSULTORES
-- Create date: <17-12-2014>
-- Description:	<Distribución de Gastos por Renglon de Compra>
-- =============================================
CREATE PROCEDURE [dbo].[pObtenerDistribucionCostoRengComp] @gRowguidComp UNIQUEIDENTIFIER
AS
BEGIN
	SET NOCOUNT ON;
	select DC.distrib_num, SUM(DCRR.monto) as monto, DCDR.reng_num  from saDistribCosto DC
		INNER JOIN saDistribCostoDestinoReng DCDR on DC.distrib_num = DCDR.distrib_num
		INNER JOIN saDistribCostoRelaReng DCRR on DC.distrib_num = DCRR.distrib_num_destino		
		AND DCDR.reng_num = DCRR.reng_num_destino
	WHERE DC.procesado = 1 AND DCDR.rowguid_comp = @gRowguidComp
	GROUP BY DC.distrib_num, DCDR.reng_num

	Select * from saFacturaCompraReng where rowguid = @gRowguidComp

END
```
