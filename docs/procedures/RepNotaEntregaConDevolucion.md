# SP: RepNotaEntregaConDevolucion
**Tipo**: Reporte
**Módulo**: Ventas

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saNotaEntregaVenta`](../tables/saNotaEntregaVenta.md)
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <03-02-11>
-- Description:	<Notas de Recepcion con sus Devoluciones>
-- =============================================
CREATE PROCEDURE [RepNotaEntregaConDevolucion]
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
                NV.doc_num AS num_nota, 
				N.doc_num AS num_doc, 
				P.doc_num, 
				dbo.fechasimple(N.fec_emis) as fec_emis, 
				dbo.fechasimple(P.fec_venc) as fec_venc, 
				P.co_mone, P.tasa,
                P.total_neto, P.co_cli, C.cli_des, 'Devolución' AS tip, 
				--N.total_neto AS neto,
				N.total_neto/ ( CASE WHEN @sCo_mone IS NULL THEN 1
                                   ELSE N.tasa
                              END ) AS neto, 
				N.fec_emis AS fecha,
                NV.reng_neto, N.total_bruto AS bruto, N.tasa AS tasar, N.co_mone AS mone, P.co_sucu_in,
                'Nota de Entrega' AS tipox
              FROM
                saNotaEntregaVenta AS P
                INNER JOIN saNotaEntregaVentaReng AS CR ON P.doc_num = CR.doc_num
                                                           AND P.anulado = 0
                INNER JOIN ( SELECT
                                SUM(( ( prec_vta * total_art ) - monto_desc - monto_desc_glob ) + ( monto_reca_glob
                                                                                                    + otros1_glob
                                                                                                    + otros2_glob
                                                                                                    + otros3_glob )
                                    + ( monto_imp + monto_imp_afec_glob )) AS reng_neto
```
