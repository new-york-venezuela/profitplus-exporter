# SP: pSeleccionarNotaEntregaIF
**Tipo**: Seleccionar
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saNotaEntregaVenta`](../tables/saNotaEntregaVenta.md)
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pSeleccionarNotaEntregaIF
*DESCRIPCIÓN	: Selecciona una nota de entrega de venta
*AUTOR			: SOFTECH SISTEMAS
*FECHA CREACION : 2019-06-14
*************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarNotaEntregaIF] ( @sDoc_Num CHAR(20) )
AS 
  BEGIN
		SELECT 
			'Nota de Entrega' nom_tipodoc
		, pv.doc_num num_doc
		, pv.fec_emis, pv.co_cli
		, left(RTRIM(C.cli_des),40) razon_social1
		, case when LEN(RTRIM(C.cli_des))>40 
					 then SUBSTRING(RTRIM(C.cli_des),41,LEN(RTRIM(C.cli_des))-40) 
					 else '' 
					 end razon_social2
		, RTRIM(v.ven_des) vendedor
		, suma.total_art
		,	pv.total_bruto sub_total
		, pv.monto_imp iva
		, pv.total_neto total_doc
		FROM
			saNotaEntregaVenta pv 
				inner join saCliente c ON pv.co_cli=c.co_cli
				inner join saVendedor v ON pv.co_ven=v.co_ven
				inner join
				(
					SELECT a.doc_num, SUM(a.total_art) total_art 
						FROM saNotaEntregaVentaReng a 
						WHERE a.doc_num = @sDoc_Num
						GROUP BY a.doc_num
				) suma ON pv.doc_num=suma.doc_num
				WHERE pv.doc_num = @sDoc_Num
	END
```
