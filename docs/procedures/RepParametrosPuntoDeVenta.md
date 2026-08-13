# SP: RepParametrosPuntoDeVenta
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`pvParEmp`](../tables/pvParEmp.md)
- [`saCaja`](../tables/saCaja.md)
- [`saCuentaIngEgr`](../tables/saCuentaIngEgr.md)
- [`saTipoCliente`](../tables/saTipoCliente.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <12/02/2015>
-- Description:	<Reporte de Parametros de Punto de Venta>
-- LAST DATE:	2017-06-27
-- =============================================
CREATE PROCEDURE [dbo].[RepParametrosPuntoDeVenta]

       @sCampOrderBy VARCHAR(16) = NULL ,
       @sDir VARCHAR(6) = NULL,
	   @sNombreDBMaestra VARCHAR(60) ,
	   @bHeaderRep BIT = 0

AS 

    BEGIN
        SET NOCOUNT ON ;

             declare @query NVARCHAR(100)
             set @query = 'select Cod_Usuario, Desc_Usuario from '+ @sNombreDBMaestra +'.[dbo].[MpUsuario]'

DECLARE @TablaUsuario TABLE
            (
                           Cod_Usuario char(6),
                           Desc_Usuario varchar(60)
            )

insert into 
@TablaUsuario
EXEC sp_executesql @query

        SELECT
            PE.cod_emp,cod_usu,PE.co_cta_ingr_egr,PE.co_cta_ingr_egr_FacDev,PE.cod_caja,PE.tf_vendedor,PE.tf_num_turno,PE.tf_consecutivos,
      PE.tf_caja,PE.tf_sucursal,PE.tf_cajero,PE.tf_num_items,PE.man_turno,PE.manejo_identificadores,PE.co_imagen,PE.descrip_imagen,PE.uso_ncr,
      PE.fp_efectivo,PE.fp_vale,PE.fp_cheque,PE.fp_tarjd,PE.fp_tarjc,PE.monto_max_vuelto,PE.monto_min_cheque,PE.monto_min_tarjd,PE.monto_min_tarjc,
      PE.dev_efectivo,PE.dev_cheque,PE.dev_tarjeta,PE.dev_ncr,PE.dev_vale,PE.expre_reg_telef_val,PE.expre_reg_telef_ejm,PE.expre_reg_email_val,
      PE.expre_reg_email_ejm,PE.tipo_cliente,PE.etiqueta_impuesto,PE.logo_empresa,PE.autoriza_dev_efect,PE.dias_max_dev,PE.monto_min_dev,
      PE.monto_max_dev,
         CLI.des_tipo, (select Desc_Usuario from @TablaUsuario where Cod_Usuario = PE.cod_usu) as des_usuario,
         CUE1.descrip as cta_ing_egre, 
         CUE2.descrip as cta_facDev,
         CAJ.descrip as caja,
         PE.fp_deposito, PE.monto_min_deposito,
         PE.fp_transferencia, PE.monto_min_transferencia,
         PE.co_cta_ingr_egr_banco,
         CUE3.descrip as cta_ing_egre_banco
        FROM
            pvParEmp as PE
                    left join saTipoCliente as CLI on PE.tipo_cliente = CLI.tip_cli
                    left join saCuentaIngEgr as CUE1 on PE.co_cta_ingr_egr = CUE1.co_cta_ingr_egr                 
                    left join saCuentaIngEgr as CUE2 on PE.co_cta_ingr_egr_FacDev = CUE2.co_cta_ingr_egr
                    left join saCaja as CAJ on PE.cod_caja = CAJ.cod_caja
                    left join saCuentaIngEgr
```
