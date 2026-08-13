# SP: pSeleccionarContabilizacionOrdenPago
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBeneficiario`](../tables/saBeneficiario.md)
- [`saCaja`](../tables/saCaja.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saCuentaIngEgr`](../tables/saCuentaIngEgr.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)
- [`saOrdenPago`](../tables/saOrdenPago.md)
- [`saOrdenPagoReng`](../tables/saOrdenPagoReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarContabilizacionOrdenPago
DESCRIPCION: Selecciona los datos a contabilizar de Orden de Pago
CREADO POR: SOFTECH SISTEMAS
CREADO EL: 2017-05-16
MODIFICADO : 2018-05-11
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarContabilizacionOrdenPago]
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
        SELECT          
            OP.ord_num AS Co_Doc, OP.status , OP.fecha AS Fec_Emis, OP.co_sucu_in AS Co_Sucu_Cont,  B.cod_ben AS Co_Auxiliar,
            B.ben_des AS Descrip_Auxiliar, OP.ord_num, OP.cod_ben, OP.descrip, OP.forma_pag, OP.fec_pag, OP.cod_cta, OP.doc_num, OP.cod_caja,
            OP.mov_num_c, OP.mov_num_b, OP.feccom, OP.dis_cen AS dis_cen_saOrdenPago, OP.numcom , OP.tasa, 
            OP.co_mone, OP.anulado, OP.sino_reten, OP.pagar, OP.origen, OP.origen_d, OP.campo1, OP.campo2, OP.campo3, OP.campo4, OP.campo5, OP.campo6,
            OP.campo7, OP.campo8, OP.co_us_in, OP.co_sucu_in, OP.fe_us_in, OP.co_us_mo, OP.co_sucu_mo, OP.fe_us_mo, OP.revisado,
            OP.trasnfe, OP.validador, OP.rowguid, CONVERT(bit, ISNULL(OPR.tiene,0)) AS tiene_reng, ROUND((OPR.monto_reten * op.TASA),2) AS monto_reten,
            ROUND((OPR.monto - OPR.monto_reten) * OP.tasa, 2) AS monto,  
            ROUND((OPR.monto_iva) * OP.tasa, 2) AS monto_iva,  
            MC.dis_cen AS dis_cen_saMovimientoCaja, ROUND((MB.idb * OP.tasa),2) as idb, MB.dis_cen AS dis_cen_saMovimientoBanco, CC.dis_cen AS dis_cen_saCaja,
            CIE.dis_cen AS dis_cen_saCuentaIngEgr, CB.dis_cen AS dis_cen_saCuentaBancaria, B.dis_cen AS dis_cen_saBeneficiario, B.ben_des
        FROM
            saOrdenPago AS OP
            LEFT JOIN 
            (SELECT ord_num,(CASE WHEN COUNT(ord_num) > 0 THEN 1 ELSE 0 END) AS tiene, SUM(monto_d - monto_h) AS monto,
            SUM(monto_reten) AS monto_reten, SUM(round(monto_iva * (CASE WHEN monto_d > 0 THE
```
