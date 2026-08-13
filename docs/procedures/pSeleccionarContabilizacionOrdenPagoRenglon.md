# SP: pSeleccionarContabilizacionOrdenPagoRenglon
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBeneficiario`](../tables/saBeneficiario.md)
- [`saCaja`](../tables/saCaja.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saCuentaIngEgr`](../tables/saCuentaIngEgr.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)
- [`saOrdenPago`](../tables/saOrdenPago.md)
- [`saOrdenPagoReng`](../tables/saOrdenPagoReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <10/09/2010>
-- Last Update: 2018-05-10
-- Description:	<pSeleccionarContabilizacionOrdenPagoRenglon>
-- =============================================

CREATE PROCEDURE [dbo].[pSeleccionarContabilizacionOrdenPagoRenglon]
    (
      @sCo_Doc_Padre CHAR(20) = NULL ,
      @sdFechaDesde SMALLDATETIME ,
      @sdFechHasta SMALLDATETIME ,
      @sCo_Sucu_Desde CHAR(6) = NULL ,
      @sCo_Sucu_Hasta CHAR(6) = NULL ,
      @bDocnoint BIT --Documentos no Contabilizados
	
    )
AS 
    BEGIN
        SELECT          
            OP.ord_num AS Co_Doc_Padre, OPR.reng_num AS Co_Doc, OP.fecha AS Fec_Emis, MO.relacion AS mone_relacion,
            B.cod_ben AS Co_Auxiliar, B.ben_des AS Descrip_Auxiliar, OPR.co_sucu_in AS Co_Sucu_Cont, OPR.co_cta_ingr_egr, OPR.co_islr,
            ROUND((OPR.monto_d * OP.tasa),2) AS monto_d,
			ROUND((OPR.monto_h * OP.tasa),2) AS monto_h,
            ROUND((OPR.monto_d - OPR.monto_iva) * OP.tasa ,2) AS monto_d_iva,
            ROUND((OPR.monto_h - OPR.monto_iva) * OP.tasa,2) AS monto_h_iva,
            ROUND((OPR.monto_iva * OP.tasa),2) AS monto_iva, 
			ROUND((OPR.monto_obj * OP.tasa),2) AS monto_obj, 
			ROUND((OPR.sustraendo * OP.tasa),2) AS sustraendo, 
			ROUND((OPR.monto_reten * OP.tasa),2) AS monto_reten,
			OPR.porc_retn, 
            OPR.tipo_imp, OPR.descrip, OPR.dis_cen AS dis_cen_saOrdenPagoReng, OPR.co_us_in, OPR.co_sucu_in,OPR.fe_us_in, 
            OPR.co_us_mo, OPR.co_sucu_mo, OPR.fe_us_mo,OPR.revisado,OPR.trasnfe, OPR.rowguid, OP.forma_pag,
            CC.dis_cen AS dis_cen_saCaja, CIE.dis_cen AS dis_cen_saCuentaIngEgr, B.dis_cen AS dis_cen_saBeneficiario, B.ben_des
        FROM
            saOrdenPagoReng AS OPR
            INNER JOIN saOrdenPago OP ON OPR.ord_num = OP.ord_num
            LEFT JOIN saMovimientoCaja AS MC ON MC.mov_num = OP.mov_num_c
            LEFT JOIN saCaja AS CC ON OP.cod_caja = CC.cod_caja
            LEFT JOIN saCuentaIngEgr AS CIE ON OPR.co_cta_ingr_egr = CIE.co_cta_ingr_egr
			LEFT JOIN saCuentaBancaria AS CB ON OP.cod_cta = CB.cod_cta            
			LEFT JOIN saBeneficiario AS B ON OP.cod_ben = B.cod_ben
            INNER JOIN saMoneda AS MO ON isnull(CC.co_mone,CB.co_mone)  = MO.co_mone
        WHERE

      OPR.ord_num = @sCo_Doc_Padre

      ORDER BY
            Fec_Emis ASC, Co_Doc ASC
    END
```
