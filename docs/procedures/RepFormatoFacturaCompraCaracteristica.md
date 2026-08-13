# SP: RepFormatoFacturaCompraCaracteristica
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`pvArticuloExt`](../tables/pvArticuloExt.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saSubLinea`](../tables/saSubLinea.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS
 Create date:	<24-04-13>
 Description:	<Factura de Compra con su Caracteristica>
 =============================================*/ 
CREATE PROCEDURE [dbo].[RepFormatoFacturaCompraCaracteristica]
	-- Add the parameters for the stored procedure here
    @sDoc_Num_d CHAR(20) = NULL ,
    @sDoc_Num_h CHAR(20) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,    
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
       select 
		e.co_prov, prov.prov_des, prov.rif, prov.telefonos, prov.direc1, prov.direc2,
		e.doc_num, e.fec_emis, e.fec_venc, e.co_cond, cp.cond_des, e.descrip, 
		e.co_mone,   
		r.co_art, a.modelo, a.art_des,  r.co_alma, r.cost_unit as 'Cantidad', 
		r.co_uni, r.total_art, r.porc_desc, r.monto_desc, r.porc_imp, r.monto_imp, r.reng_neto, v.cantidad*-1 as 'CantidadCaracteristica',
		sub_01.subl_des as subl_des01, sub_02.subl_des as subl_des02,
		sub_03.subl_des as subl_des03,  sub_04.subl_des as subl_des04, 
		sub_05.subl_des as subl_des05,
		e.total_bruto, e.monto_imp, e.monto_desc_glob, e.monto_reca, e.otros1, e.otros2, e.otros3, e.total_neto
		,E.porc_reca,E.porc_desc_glob,r.reng_num,
		r.comentario,
		case when r.comentario<>'' then Aext.DescripRenglonTxt else 'Desc Ext.' end as DescripRenglonTxt
	   from saFacturaCompra E   
	   inner join saFacturaCompraReng R on e.doc_num = r.doc_num 
	   left join savArtCaracteristicaCOMP V on r.doc_num = v.num_doc and r.reng_num = v.reng_num 
	   inner join saArticulo A on a.co_art = r.co_art
	   left join pvArticuloExt Aext on Aext.id = a.rowguid
	   inner join saProveedor prov on prov.co_prov = e.co_prov
	   inner join saCondicionPago cp on cp.co_cond = e.co_cond
       left join sasublinea as sub_01 on sub_01.co_lin = v.co_lin01 and sub_01.co_subl = v.co_subl01
	   left join sasublinea as sub_02 on sub_02.co_lin = v.co_lin02 and sub_02.co_subl = v.co_subl02
	   left join sasublinea as sub_03 on sub_03.co_lin = v.co_lin03 and sub_03.co_subl = v.co_subl03
	   left join sasublinea as sub_04 on sub_04.co_lin = v.co_lin04 and sub_04.co_subl = v.co_subl04
	   left join sasublinea as sub_05 on sub_05.co_lin = v.co_lin05 and sub_05.co_subl = v.co_subl05
        WHERE
            (@sDoc_Num_d IS NULL OR e.doc_num >= @sDoc_Num_d)
		AND (@sDoc_Num_h IS NULL OR e.doc_num <= @sDoc_Num_h)
		AND (@sCo_Sucursal IS NULL OR e.co_
```
