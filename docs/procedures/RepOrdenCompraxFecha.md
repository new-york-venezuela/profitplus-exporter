# SP: RepOrdenCompraxFecha
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saOrdenCompra`](../tables/saOrdenCompra.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <05/08/2010>
-- Description:	<Reporte de Ordenes Compras por Fecha>
-- =============================================
CREATE PROCEDURE [RepOrdenCompraxFecha] 
	-- Add the parameters for the stored procedure here
    @cCo_Numero_d CHAR(20) = NULL ,
    @cCo_Numero_h CHAR(20) = NULL ,
    @dCo_fecha_d SMALLDATETIME = NULL ,
    @dCo_fecha_h SMALLDATETIME = NULL ,
    @cCo_Proveedor_d CHAR(16) = NULL ,
    @cCo_Proveedor_h CHAR(16) = NULL ,
    @cCo_Zona_d CHAR(6) = NULL ,
    @cCo_Zona_h CHAR(6) = NULL ,
    @cImprSubTotal CHAR(6) = NULL ,
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
-------------------------------
        IF ( @cStatus IS NULL ) 
            SET @cStatus = 'TODO'
        IF ( @cAnulado IS NULL ) 
            SET @cAnulado = 'TODO'
        IF ( @cImprSubTotal IS NULL ) 
            SET @cImprSubTotal = 'SI'
-------------------------------
        SELECT
            @cAnulado AS Filtro_anulado, @cImprSubTotal AS SubTotales, 'orden' AS tip_rep, PRO.tip_pro, PRO.prov_des,
            PRO.co_zon, PRO.co_seg, OC.doc_num, OC.descrip, OC.co_prov, OC.co_mone, OC.co_cond, OC.fec_emis, OC.fec_venc,
            OC.fec_reg, OC.anulado, OC.status, OC.n_control, OC.tasa, OC.porc_desc_glob, OC.monto_desc_glob,
            OC.porc_reca, OC.monto_reca, OC.total_bruto, OC.monto_imp, OC.monto_imp2, OC.monto_imp3, OC.otros1,
            OC.otros2, OC.otros3, OC.total_neto / ( CASE WHEN @cCo_Moneda IS NULL THEN 1
                                                         ELSE OC.tasa
                                                    END ) AS total_neto,
            OC.saldo / ( CASE WHEN @cCo_Moneda IS NULL THEN 1
                              ELSE OC.tasa
                         END ) AS saldo, OC.dir_ent, OC.comentario, OC.dis_cen, OC.feccom, OC.numcom, OC.impresa,
            OC.salestax, OC.campo1, OC.campo2, OC.campo3, OC.campo4, OC.campo5, OC.campo6, OC.campo7, OC.campo8,
            OC.co_us_in, OC.co_sucu_i
```
