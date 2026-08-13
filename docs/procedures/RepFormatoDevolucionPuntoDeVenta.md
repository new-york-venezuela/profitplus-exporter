# SP: RepFormatoDevolucionPuntoDeVenta
**Tipo**: Reporte
**Módulo**: Ventas

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`pvArticuloExt`](../tables/pvArticuloExt.md)
- [`saAdiCampo`](../tables/saAdiCampo.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saDocumentoVentaInfoIGTF`](../tables/saDocumentoVentaInfoIGTF.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saTransporte`](../tables/saTransporte.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			RepFormatoDevolucionPuntoDeVenta
DESCRIPCION:	OBTIENE EL RESULTADO DE UNA DEVOLUCION INMEDIATAMENTE HECHA DESDE PUNTO DE VENTA 2.0
CREADO POR:		SOFTECH SISTEMAS
CREATE DATE:    2013-09-09
LAST DATE:		2017-06-27
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[RepFormatoDevolucionPuntoDeVenta]
			@sDoc_Num_d			CHAR(20)	=	NULL ,
			@sDoc_Num_h			CHAR(20)	=	NULL ,
			@sCo_Sucursal		CHAR(6)		=	NULL ,
			@bHeaderRep BIT = 0     
		AS 
			BEGIN
				SET NOCOUNT ON ;

				declare @DirFis as nvarchar(254)
				declare @Telef as nvarchar(254)
				declare @MonedaBase as char(6)

				select @DirFis=val_str from saAdiCampo where co_adicampo = 'dir_fis'
				select @Telef=val_str from saAdiCampo where co_adicampo ='telef'
				select @MonedaBase=g_moneda from par_emp 

			    SELECT 
				e.co_cli, cli.cli_des, cli.rif, cli.telefonos, cli.direc1,
				e.doc_num, e.fec_emis, e.fec_venc, e.co_cond, cp.cond_des, e.descrip, 
				e.co_mone, e.co_ven, Ven.ven_des, e.co_tran, Tra.des_tran,
				r.co_art, a.modelo, ISNULL(r.des_art, a.art_des) AS art_des,  r.co_alma, r.total_art AS 'Cantidad', r.tipo_doc,r.num_doc,
				r.co_uni, r.prec_vta, 
				--r.porc_desc,
				case when r.monto_desc = 0 THEN NULL ELSE r.porc_desc END as 'porc_desc', 
				r.monto_desc, r.porc_imp, r.monto_imp, r.reng_neto,
				--CC 11-02-25
				(r.reng_neto - r.monto_desc_glob + r.monto_reca_glob) as 'reng_neto_glob',
				 (r.monto_imp + r.monto_imp_afec_glob) as 'monto_imp_glob',
				 FV.total_neto as 'total_netoFV',FV.fec_emis as 'fec_emisFV',FV.n_control as 'n_controlFV',@DirFis as 'DirFis',@Telef as 'Telef',@MonedaBase as 'MonedaBase',
				-- FIN CC 11-02-25
				e.total_bruto, e.monto_imp, e.monto_desc_glob, e.monto_reca, 
				CASE WHEN (ISNULL(DVI.base_imponible,0) > 0 ) THEN 0.00 ELSE e.otros1 END AS otros1,
				e.otros2, e.otros3, e.total_neto,
				e.porc_reca, e.porc_desc_glob, r.reng_num, E.nro_doc, r.comentario,
				CASE WHEN r.comentario<>'' THEN Aext.DescripRenglonTxt ELSE 'Desc Ext.' END AS DescripRenglonTxt,

				CASE WHEN ISNULL(DVI.base_imponible, 0) = 0 THEN 0.00 else ISNULL(DVI.base_imponible,0) end as base_imponible,
			    CASE WHEN ISNULL(DVI.base_imponible, 0) = 0 THEN 0.00 else ISNULL(DVI.porc_aplic,0) end as porc_aplic,
			    CASE WHEN IS
```
