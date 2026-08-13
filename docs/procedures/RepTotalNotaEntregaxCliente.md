# SP: RepTotalNotaEntregaxCliente
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saNotaEntregaVenta`](../tables/saNotaEntregaVenta.md)
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <10/08/2010>
-- Description:	<Reporte de Total de Notas de Entrega por Cliente>
-- =============================================
CREATE PROCEDURE [RepTotalNotaEntregaxCliente]
    @sCo_fecha_d SMALLDATETIME = NULL ,
    @sCo_fecha_h SMALLDATETIME = NULL ,
    @sCo_Cli_d CHAR(16) = NULL ,
    @sCo_Cli_h CHAR(16) = NULL ,
    @sCo_Zona_d CHAR(6) = NULL ,
    @sCo_Zona_h CHAR(6) = NULL ,
    @sCo_Segmento_d CHAR(6) = NULL ,
    @sCo_Segmento_h CHAR(6) = NULL ,
    @cCo_Moneda CHAR(6) = NULL ,
    @cCo_Sucursal CHAR(6) = NULL ,
    @sOperacion CHAR(20) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        IF @sCo_fecha_d IS NOT NULL 
            SET @sCo_fecha_d = dbo.FechaSimple(@sCo_fecha_d)
        IF @sCo_fecha_h IS NOT NULL 
            SET @sCo_fecha_h = dbo.FechaSimple(@sCo_fecha_h)

        SET @sOperacion = 'Nota de Entrega'

        SELECT
            @sOperacion AS Operacion, NE.doc_num, NE.descrip, NE.co_cli, NE.co_tran, NE.co_mone, NE.co_ven, NE.co_cond,
            NE.fec_emis, NE.fec_venc, NE.fec_reg, NE.anulado, NE.status, NE.n_control, NE.ven_ter, NE.tasa,
            NE.porc_desc_glob, NE.monto_desc_glob, NE.porc_reca, NE.monto_reca, NER.monto_imp, NE.monto_imp2,
            NE.monto_imp3, NER.otros1, NER.otros2, NER.otros3, NE.total_neto, NE.saldo, NE.dir_ent, NE.comentario,
            NE.dis_cen, NE.feccom, NE.numcom, NE.contrib, NE.impresa, NE.seriales_s, NE.salestax, NE.impfis,
            NE.impfisfac, NE.campo1, NE.campo2, NE.campo3, NE.campo4, NE.campo5, NE.campo6, NE.campo7, NE.campo8,
            NE.co_us_in, NE.co_sucu_in, NE.fe_us_in, NE.co_us_mo, NE.co_sucu_mo, NE.fe_us_mo, NE.revisado, NE.trasnfe,
            NE.validador, NE.rowguid
		/*Campos Reng
		CCR.reng_num,CCR.doc_num,CCR.co_art,CCR.des_art,CCR.co_alma,CCR.total_art,CCR.stotal_art,CCR.co_uni,
		CCR.sco_uni,CCR.co_precio,CCR.prec_vta,CCR.prec_vta_om,CCR.porc_desc,CCR.monto_desc,CCR.tipo_imp,CCR.tipo_imp2,
		CCR.tipo_imp3,CCR.porc_imp,CCR.porc_imp2,CCR.porc_imp3,CCR.monto_imp,CCR.monto_imp2,CCR.monto_imp3,CCR.reng_neto,
		CCR.pendiente,CCR.pendiente2,CCR.tipo_doc,CCR.num_doc,CCR.rowguid_doc,CCR.total_dev,CCR.monto_dev,CCR.otros,CCR.comentario,
		CCR.lote_asignado,CCR.dis_cen,CCR.co_us_in,CCR.co_sucu_in,CCR.fe_us_in,CCR.co_us_mo,CCR.co_sucu_mo
```
