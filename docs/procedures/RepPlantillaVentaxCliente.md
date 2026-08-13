# SP: RepPlantillaVentaxCliente
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saPlantillaVenta`](../tables/saPlantillaVenta.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <04/08/2010>
-- Description:	<Reporte de Plantilla de Venta por Cliente>
-- =============================================
CREATE PROCEDURE [RepPlantillaVentaxCliente] 
	-- Add the parameters for the stored procedure here
    @cCo_Numero_d CHAR(20) = NULL ,
    @cCo_Numero_h CHAR(20) = NULL ,
    @dCo_fecha_d SMALLDATETIME = NULL ,
    @dCo_fecha_h SMALLDATETIME = NULL ,
    @cCo_cliente_d CHAR(16) = NULL ,
    @cCo_cliente_h CHAR(16) = NULL ,
    @cCo_Vendedor_d CHAR(6) = NULL ,
    @cCo_Vendedor_h CHAR(6) = NULL ,
    @cCo_Transporte_d CHAR(6) = NULL ,
    @cCo_Transporte_h CHAR(6) = NULL ,
    @cCo_Zona_d CHAR(6) = NULL ,
    @cCo_Zona_h CHAR(6) = NULL ,
    @cCo_Segmento_d CHAR(6) = NULL ,
    @cCo_Segmento_h CHAR(6) = NULL ,
    @cCo_Moneda CHAR(6) = NULL ,
    @cStatus CHAR(6) = NULL ,
    @cAnulado CHAR(6) = NULL ,
    @cCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        IF @dCo_fecha_d IS NOT NULL 
            SET @dCo_fecha_d = dbo.FechaSimple(@dCo_fecha_d)
        IF @dCo_fecha_h IS NOT NULL 
            SET @dCo_fecha_h = dbo.FechaSimple(@dCo_fecha_h)
-- Insert statements for procedure here
-------------------------------
        IF ( @cStatus IS NULL ) 
            SET @cStatus = 'TODO'
        IF ( @cAnulado IS NULL ) 
            SET @cAnulado = 'TODO'
-------------------------------

        SELECT
            @cAnulado AS Filtro_anulado, 'PLANTI' AS tipo_rep, CLI.tip_cli, CLI.cli_des, CLI.co_zon, CLI.co_seg,
            PV.doc_num, PV.descrip, PV.co_cli, PV.co_tran, PV.co_mone, PV.co_ven, PV.co_cond, PV.fec_emis, PV.fec_venc,
            PV.fec_reg, PV.anulado, PV.status, PV.n_control, PV.ven_ter, PV.tasa, PV.porc_desc_glob, PV.monto_desc_glob,
            PV.porc_reca, PV.monto_reca, PV.total_bruto, PV.monto_imp, PV.monto_imp2, PV.monto_imp3, PV.otros1,
            PV.otros2, PV.otros3, PV.total_neto / ( CASE WHEN @cCo_Moneda IS NULL THEN 1
                                                         ELSE PV.tasa
                                                    END ) AS total_neto,
            PV.saldo / ( CASE WHEN @cCo_Moneda IS NULL THEN 1
                              ELSE PV.tasa
                         END ) AS saldo, PV.dir_ent, PV.comentario, PV.dis_cen, PV.feccom, PV.nu
```
