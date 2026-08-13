# SP: pSeleccionarContabilizacionMovimientoCaja
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCaja`](../tables/saCaja.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saCuentaIngEgr`](../tables/saCuentaIngEgr.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)
- [`saOrdenPago`](../tables/saOrdenPago.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarContabilizacionMovimientoCaja
DESCRIPCION: Selecciona los datos a contabilizar de Movientos de Caja
CREADO POR: SOFTECH SISTEMAS
CREADO EL: 27/05/2010
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarContabilizacionMovimientoCaja]
    (
      @sdFechaDesde SMALLDATETIME ,
      @sdFechHasta SMALLDATETIME ,
      @sCo_Sucu_Desde CHAR(6) = NULL ,
      @sCo_Sucu_Hasta CHAR(6) = NULL ,
      @bDocnoint BIT --Documentos no Contabilizados
	
    )
AS 
    BEGIN
	
        IF @sdFechaDesde IS NOT NULL 
            SET @sdFechaDesde = dbo.FechaSimple(@sdFechaDesde)
        IF @sdFechHasta IS NOT NULL 
            SET @sdFechHasta = dbo.FechaSimple(@sdFechHasta)
        SELECT     MC.mov_num AS Co_Doc, MC.fecha as fec_emis, MC.co_sucu_in AS Co_Sucu_Cont, '' AS Co_Auxiliar, '' AS Descrip_Auxiliar, MC.mov_num, MC.descrip, MC.cod_caja, MC.co_ban, 
                      MC.co_tar, MC.co_cta_ingr_egr, MC.tasa, MC.tipo_mov, MC.forma_pag, MC.num_pago, MC.saldo_ini,
                      ROUND(MC.monto_d * MC.tasa, 2) AS monto_d, ROUND(MC.monto_h * MC.tasa, 2) AS monto_h,
                      MC.dep_num, MC.origen, MC.doc_num, MC.anulado, 
                      MC.depositado, MC.transferido, MC.mov_nro, MC.aux01, MC.aux02, MC.campo1, MC.campo2, MC.campo3, MC.campo4, MC.campo5, MC.campo6, MC.campo7, 
                      MC.campo8, MC.co_us_in, MC.co_sucu_in, MC.fe_us_in, MC.co_us_mo, MC.co_sucu_mo, MC.fe_us_mo, MC.revisado, MC.trasnfe, MC.validador, MC.rowguid, 
                      MC.feccom, MC.numcom, MC.dis_cen AS dis_cen_saMovimientoCaja, CC.dis_cen AS dis_cen_saCaja, OP.dis_cen AS dis_cen_saOrdenPago, 
                      CIE.dis_cen AS dis_cen_saCuentaIngEgr, ct.dis_cen as dis_cen_saCuentaBancaria
					-->>JN 20200218 Sit# 98589
					  , MO.co_mone, MO.mone_des
					--<<JN 20200218 Sit# 98589
		FROM         dbo.saMovimientoCaja AS MC LEFT OUTER JOIN
                      dbo.saCaja AS CC ON MC.cod_caja = CC.cod_caja LEFT OUTER JOIN
                      dbo.saCuentaIngEgr AS CIE ON MC.co_cta_ingr_egr = CIE.co_cta_ingr_egr LEFT OUTER JOIN
                      dbo.saOrdenPago AS OP ON MC.mov_num = OP.mov_num_b INNER JOIN
                      dbo.saMoneda AS MO ON CC.co_mone = MO.co_mone LEFT OUTER
```
