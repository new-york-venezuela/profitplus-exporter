# SP: RepFacturaPuntoDeVentaActual
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`pvArticuloExt`](../tables/pvArticuloExt.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saTransporte`](../tables/saTransporte.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
		NOMBRE:			[RepFacturaPuntoDeVentaActual
		DESCRIPCION:	REPORTE DE FACTURA ACTUAL DE PUNTO DE VENTA
		CREADO POR:		SOFTECH SISTEMAS
		***************************************************************************************************************/
		CREATE PROCEDURE [dbo].[RepFacturaPuntoDeVentaActual]
    @sDoc_Num_d			CHAR(20)		=		NULL ,
    @sDoc_Num_h			CHAR(20)		=		NULL ,
    @sCo_Sucursal		CHAR(6)			=		NULL ,    
    @sCampOrderBy		VARCHAR(16)		=		NULL ,
    @sDir				VARCHAR(6)		=		NULL ,
    @bHeaderRep			BIT				=		0
AS 
    BEGIN
        SET NOCOUNT ON ;

        SELECT 
			e.co_cli, cli.cli_des, cli.rif, cli.telefonos,cli.direc1,
			e.comentario AS comentario1,		
			e.dir_ent, e.doc_num, e.co_mone, 
			e.descrip, e.fec_emis, e.fec_venc, 
			e.co_cond, cp.cond_des, 
			e.co_ven, Ven.ven_des, 
			e.co_tran, Tra.des_tran,
			dbo.SumaNetoReng(@sDoc_Num_d) AS total_bruto,
			ROUND(dbo.CalcularMontoPorcentaje( e.porc_desc_glob, R.reng_neto, 0),2) AS montoDescEncabezado, e.porc_desc_glob,
			ROUND(dbo.CalcularMontoPorcentaje(e.porc_reca, R.reng_neto, 1),2) AS montoRecaEncabezado, e.porc_reca, 
			e.otros1, e.otros2, e.otros3, 
			r.co_art, a.modelo, ISNULL(r.des_art, a.art_des) AS art_des,  
			r.co_alma, r.total_art AS 'Cantidad', 
			r.co_uni, r.prec_vta, r.porc_desc, r.monto_desc AS descRenglon, r.reng_neto, 
			r.reng_num,	
			r.comentario, 
			r.porc_imp, r.monto_imp, r.monto_desc,
			ROUND(((R.reng_neto + ROUND(dbo.CalcularMontoPorcentaje(e.porc_reca, R.reng_neto, 1),2) - ROUND(dbo.CalcularMontoPorcentaje( e.porc_desc_glob, R.reng_neto, 0),2) ) * R.porc_imp ) / 100, 2) - R.monto_imp AS monto_imp_afec,
			CASE WHEN r.comentario<>'' AND r.comentario IS NOT NULL THEN Aext.DescripRenglonTxt ELSE '' END AS DescripRenglonTxt

				FROM saFacturaVenta E
				   INNER JOIN saFacturaVentaReng R ON e.doc_num = r.doc_num 
				   INNER JOIN saArticulo A ON a.co_art = r.co_art
				   LEFT JOIN pvArticuloExt Aext ON Aext.id = a.rowguid
				   INNER JOIN saVendedor Ven ON ven.co_ven = e.co_ven
				   INNER JOIN saTransporte Tra ON tra.co_tran = e.co_Tran
				   INNER JOIN saCliente cli ON cli.co_cli = e.co_cli
				   INNER JOIN saCondicionPago cp ON cp.co_cond = e.co_cond
				WHERE
						(@sDoc_Num_d IS NULL OR e.doc_num >= @sDoc_Num_d)
					AND (@sDoc_Num_h IS NULL OR e.doc_num <= @sDoc_Num_h)
					AND (@sC
```
