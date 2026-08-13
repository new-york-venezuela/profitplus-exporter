# SP: pSeleccionarRenglonesCotizacionClienteIF
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saCotizacionClienteReng`](../tables/saCotizacionClienteReng.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			:pSeleccionarRenglonesCotizacionClienteIF
*DESCRIPCIÓN	: Selecciona renglones de una cotización de un cliente
*AUTOR			: SOFTECH SISTEMAS
*FECHA CREACION : 2019-06-14
*************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarRenglonesCotizacionClienteIF] ( @sDoc_Num CHAR(20) )
AS 
  BEGIN

		SELECT 
			left(rtrim(a.art_des),40) art_des,pv.total_art,pv.porc_imp tasa,pv.prec_vta,pv.reng_neto
		FROM 
			saCotizacionClienteReng pv 
				inner join saArticulo a on pv.co_art=a.co_art
				WHERE PV.doc_num = @sDoc_Num
	END
```
