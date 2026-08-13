# SP: RepFormatoDevolucionClienteCaracteristica
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saSubLinea`](../tables/saSubLinea.md)
- [`saTransporte`](../tables/saTransporte.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS
 Create date:	<24-04-13>
 Description:	<Formato Devolucion de Cliente con su Caracteristica>
 =============================================*/ 
CREATE PROCEDURE [dbo].[RepFormatoDevolucionClienteCaracteristica]
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
		e.co_cli, cli.cli_des, cli.rif, cli.telefonos, cli.direc1, (CASE WHEN (E.dir_ent IS NOT NULL AND len(ltrim(E.dir_ent)) > 0) THEN E.dir_ent ELSE cli.dir_ent2 END) as dir_ent2,
		e.doc_num, e.fec_emis, e.fec_venc, e.co_cond, cp.cond_des, e.descrip, 
		e.co_mone, e.co_ven, Ven.ven_des, e.co_tran, Tra.des_tran,
		r.co_art, a.modelo, a.art_des,  r.co_alma, r.total_art as 'Cantidad', r.tipo_doc,r.num_doc,
		r.co_uni, r.prec_vta, r.porc_desc, r.monto_desc, r.porc_imp, r.monto_imp, r.reng_neto, v.cantidad*-1 as 'CantidadCaracteristica',
		sub_01.subl_des as subl_des01, sub_02.subl_des as subl_des02,
		sub_03.subl_des as subl_des03,  sub_04.subl_des as subl_des04, 
		sub_05.subl_des as subl_des05,
		e.total_bruto, e.monto_imp, e.monto_desc_glob, e.monto_reca, e.otros1, e.otros2, e.otros3, e.total_neto
		,E.porc_reca,E.porc_desc_glob,r.reng_num
	   from saDevolucionCliente E
	   inner join saDevolucionClienteReng R on e.doc_num = r.doc_num 
	   left join savArtCaracteristicaDCLI V on r.doc_num = v.num_doc and r.reng_num = v.reng_num 
	   inner join saArticulo A on a.co_art = r.co_art
	   inner join saVendedor Ven on ven.co_ven = e.co_ven
	   inner join saTransporte Tra on tra.co_tran = e.co_Tran
	   inner join saCliente cli on cli.co_cli = e.co_cli
	   inner join saCondicionPago cp on cp.co_cond = e.co_cond
       left join sasublinea as sub_01 on sub_01.co_lin = v.co_lin01 and sub_01.co_subl = v.co_subl01
	   left join sasublinea as sub_02 on sub_02.co_lin = v.co_lin02 and sub_02.co_subl = v.co_subl02
	   left join sasublinea as sub_03 on sub_03.co_lin = v.co_lin03 and sub_03.co_subl = v.co_subl03
	   left join sasublinea as sub_04 on sub_04.co_lin = v.co_lin04 and sub_04.co_subl = v.co_subl04
	   left join sasublinea as sub_05 on sub_05.co_lin = v.co_lin05 and sub_05.co_subl = v.co_subl05
        WHERE
            (@sDoc_Num_d IS NULL OR e
```
