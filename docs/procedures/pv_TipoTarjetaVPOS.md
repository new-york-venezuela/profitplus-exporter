# SP: pv_TipoTarjetaVPOS
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvTarjetaCreditoExt`](../tables/pvTarjetaCreditoExt.md)
- [`pvTipoTarjeta`](../tables/pvTipoTarjeta.md)
- [`saTarjetaCredito`](../tables/saTarjetaCredito.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pv_TipoTarjetaVPOS]
*DESCRIPCIÓN	: BUSCA EL TIPO DE TARJETA PARA VPOS
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/
CREATE PROCEDURE [dbo].[pv_TipoTarjetaVPOS]
(
	@sco_tar	CHAR(6)
)
AS
BEGIN
	SELECT tipotarjeta FROM pvtipotarjeta pTT 
							INNER JOIN pvTarjetaCreditoExt pTTE on pTT.rowguid = pTTE.rowguid_co_tipo_tar
							INNER JOIN satarjetacredito tc on pTTE.rowguid_co_tar	= tc.rowguid
							WHERE tc.co_tar = @sco_tar
END
```
