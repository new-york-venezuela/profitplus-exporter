# SP: pSeleccionarRenglonesPedidoVentaIF
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saPedidoVentaReng`](../tables/saPedidoVentaReng.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pSeleccionarRenglonesPedidoVentaIF
*DESCRIPCIÓN	: Selecciona renglones de un pedido de venta
*AUTOR			: SOFTECH SISTEMAS
*FECHA CREACION : 2019-06-05
*************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarRenglonesPedidoVentaIF] ( @sDoc_Num CHAR(20) )
AS 
  BEGIN

		SELECT 
			left(rtrim(a.art_des),40) art_des,pv.total_art,pv.porc_imp tasa,pv.prec_vta,pv.reng_neto
		FROM 
			saPedidoVentaReng pv 
				inner join saArticulo a on pv.co_art=a.co_art
				WHERE PV.doc_num = @sDoc_Num
	END
```
