# SP: RepTotalPedidoxCliente
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saPedidoVenta`](../tables/saPedidoVenta.md)
- [`saPedidoVentaReng`](../tables/saPedidoVentaReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <10/08/2010>
-- Description:	<Reporte de Total de Pedidos por Cliente>
-- =============================================
CREATE PROCEDURE [RepTotalPedidoxCliente]
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

        SET @sOperacion = 'Pedido'

        SELECT
            @sOperacion AS Operacion, PV.doc_num, PV.descrip, PV.co_cli, PV.co_tran, PV.co_mone, PV.co_ven, PV.co_cond,
            PV.fec_emis, PV.fec_venc, PV.fec_reg, PV.anulado, PV.status, PV.n_control, PV.ven_ter, PV.tasa,
            PV.porc_desc_glob, PV.monto_desc_glob, PV.porc_reca, PV.monto_reca, PVR.monto_imp, PV.monto_imp2,
            PV.monto_imp3, PVR.otros1, PVR.otros2, PVR.otros3, PV.total_neto, PV.saldo, PV.dir_ent, PV.comentario,
            PV.dis_cen, PV.feccom, PV.numcom, PV.contrib, PV.impresa, PV.seriales_s, PV.salestax, PV.impfis,
            PV.impfisfac, PV.campo1, PV.campo2, PV.campo3, PV.campo4, PV.campo5, PV.campo6, PV.campo7, PV.campo8,
            PV.co_us_in, PV.co_sucu_in, PV.fe_us_in, PV.co_us_mo, PV.co_sucu_mo, PV.fe_us_mo, PV.revisado, PV.trasnfe,
            PV.validador, PV.rowguid, C.cli_des, PVR.total_art, PVR.coti, PVR.monto_desc,
            PVR.monto_desc_glob, PVR.pendiente,
            ROUND(( PVR.prec_vta - PVR.monto_desc - PVR.monto_desc_glob + PVR.monto_reca_glob ), 2) AS total_bruto
        FROM
            saPedidoVenta AS PV --INNER JOIN saPedidoVentaReng AS PVR ON PVR.doc_num = PV.doc_num
            INNER JOIN ( SELECT DISTINCT
                            doc_num, SUM(total_art) AS total_art, SUM(prec_vta * total_art) AS prec_vta,
                            SUM(monto_imp) + SUM(monto_imp_afec_glob) AS monto_imp, SUM(monto_desc) AS monto_desc,
```
