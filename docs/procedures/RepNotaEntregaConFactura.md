# SP: RepNotaEntregaConFactura
**Tipo**: Reporte
**Módulo**: Ventas

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saNotaEntregaVenta`](../tables/saNotaEntregaVenta.md)
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <04-10-10>
-- Description:	<Notas de Entrega con sus facturas>
-- =============================================
CREATE PROCEDURE [RepNotaEntregaConFactura]
	-- Add the parameters for the stored procedure here
    @sNumero_d CHAR(20) = NULL ,
    @sNumero_h CHAR(20) = NULL ,
    @dFecha_d SMALLDATETIME = NULL ,
    @dFecha_h SMALLDATETIME = NULL ,
    @sCo_cli_d CHAR(16) = NULL ,
    @sCo_cli_h CHAR(16) = NULL ,
    @sCo_ven_d CHAR(6) = NULL ,
    @sCo_ven_h CHAR(6) = NULL ,
    @sCo_mone CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        IF @dFecha_d IS NOT NULL 
            SET @dFecha_d = dbo.FechaSimple(@dFecha_d)
        IF @dFecha_h IS NOT NULL 
            SET @dFecha_h = dbo.FechaSimple(@dFecha_h)

        SELECT
            *
        FROM
            ( SELECT
                FR.doc_num AS num_doc, 
				N.doc_num, dbo.fechasimple(N.fec_emis) as fec_emis, 
				N.co_ven, dbo.fechasimple(N.fec_venc) as fec_venc,
				N.co_mone, 
				N.tasa, 
				N.total_neto/ ( CASE WHEN @sCo_mone IS NULL THEN 1
                                   ELSE N.tasa
                              END ) AS total_neto, 
                N.co_cli, CL.cli_des, 'Factura' AS tip, 
				F.total_neto AS neto, F.co_ven AS vende, 
				dbo.fechasimple(F.fec_emis) AS fecha,
                FR.reng_neto, F.total_bruto AS bruto, 
				F.tasa AS tasar, F.co_mone AS mone, N.co_sucu_in
              FROM
                saNotaEntregaVenta AS N
                INNER JOIN saNotaEntregaVentaReng AS CR ON N.doc_num = CR.doc_num
                                                           AND N.anulado = 0
                INNER JOIN ( SELECT
                                PR.doc_num, PR.rowguid_doc,
                                SUM(( PR.prec_vta * PR.total_art ) + PR.monto_imp + PR.monto_imp_afec_glob
                                    + PR.otros1_glob + PR.otros2_glob + PR.otros3_glob + -PR.monto_desc
                                    - PR.monto_desc_glob) AS reng_neto
                             FROM
                                saFacturaVentaReng AS PR
                             WHERE
                                tipo_doc = 'NENT'
                             GROUP BY
```
