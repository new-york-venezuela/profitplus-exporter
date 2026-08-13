# SP: pvGetConfigEmpresaPvta
**Tipo**: Punto de Venta
**Módulo**: Tesorería

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`pvEtiquetaBalanza`](../tables/pvEtiquetaBalanza.md)
- [`pvParEmp`](../tables/pvParEmp.md)
- [`saCaja`](../tables/saCaja.md)
- [`saCuentaIngEgr`](../tables/saCuentaIngEgr.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pvGetConfigEmpresaPvta
*CREACIÓN		: <2016-08-30>
*MODIFICACIÓN	: <2020-08-07>
*DESCRIPCIÓN	: Obtiene la configuración de punto de venta para la empresa
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/ 
CREATE PROCEDURE [dbo].[pvGetConfigEmpresaPvta]
AS
BEGIN

	DECLARE @man_cod INT
	
	-- Manejo de Etiquetas para Balanza
    SELECT	@man_cod = COUNT(*) 
    FROM pvEtiquetaBalanza 
    
	-- Parametros Generales de Punto de Venta
    SELECT	@man_cod AS Cod_Bar,
			a.cod_usu AS usu_pr,
			a.co_cta_ingr_egr AS cta_ing,
			c.descrip AS descrip_cta,
			a.cod_caja AS caja_prin,
			b.descrip AS des_cajp,
			a.tf_vendedor,
			a.tf_num_turno,
			a.tf_consecutivos,
			a.tf_caja,
			a.tf_sucursal,
			a.tf_cajero,
			a.tf_num_items,
			a.man_turno,
			a.manejo_identificadores,
			a.uso_ncr,
			a.fp_efectivo,
			a.fp_vale,
			a.fp_cheque,
			a.fp_tarjd,
			a.fp_tarjc,
			a.monto_max_vuelto,
			a.monto_min_cheque,
			a.monto_min_tarjd,
			a.monto_min_tarjc,
			a.dev_efectivo,
			a.dev_cheque,
			a.dev_tarjeta,
			a.dev_ncr,
			a.dev_vale,
			a.expre_reg_telef_val,
			a.expre_reg_telef_ejm,
			a.expre_reg_email_val,
			a.expre_reg_email_ejm,
			a.tipo_cliente,
			a.etiqueta_impuesto,
			a.logo_empresa,
			a.monto_min_dev,
			a.monto_max_dev,
			a.dias_max_dev,
			a.autoriza_dev_efect,
			a.co_imagen,
			a.descrip_imagen,
			a.fp_deposito,
			a.monto_min_deposito,
			a.fp_transferencia,
			a.monto_min_transferencia,
			a.co_cta_ingr_egr_banco
-->>JN 20200720
			, a.fp_efectivo_moneda2,
			a.uso_ncr_moneda2,
			a.fp_cheque_moneda2,
			a.monto_min_cheque_moneda2,
			a.fp_tarjd_moneda2,
			a.monto_min_tarjd_moneda2,
			a.fp_deposito_moneda2,
			a.monto_min_deposito_moneda2,
			a.fp_transferencia_moneda2,
			a.monto_min_transferencia_moneda2,
			a.fp_tarjc_moneda2,
			a.monto_min_tarjc_moneda2,
			a.fp_vale_moneda2,
			a.monto_max_vuelto_moneda2,
			a.cod_caja_moneda2 AS caja_prin_moneda2,
			b2.descrip AS des_cajp_moneda2,
			a.co_cta_ingr_egr_moneda2 AS cta_ing_moneda2,
			c2.descrip AS descrip_cta_moneda2,
			a.co_cta_ingr_egr_banco_moneda2,
			a.co_Mone_moneda2,
			
			a.fp_efectivo_moneda3,
			a.uso_ncr_moneda3,
			a.fp_cheque_moneda3,
			a.monto_min_cheque_moneda3,
			a.fp_tarjd_moneda3,
			a.monto_min_tarjd_moneda3,
			a.fp_deposito_moneda3,
```
