# SP: RepDevolucionProveedorxFecha
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saDevolucionProveedor`](../tables/saDevolucionProveedor.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <05/08/2010>
-- Description:	<Reporte de Devoluciones a Proveedores por Fecha>
-- =============================================
CREATE PROCEDURE [RepDevolucionProveedorxFecha] 
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
            @cAnulado AS Filtro_anulado, @cImprSubTotal AS SubTotales, 'devo' AS tip_rep, PRO.tip_pro, PRO.prov_des,
            PRO.co_zon, PRO.co_seg, DP.doc_num, DP.descrip, DP.co_prov, DP.co_mone, DP.co_cond, DP.fec_emis, DP.fec_venc,
            DP.fec_reg, DP.anulado, DP.status, DP.n_control, DP.tasa, DP.porc_desc_glob, DP.monto_desc_glob,
            DP.porc_reca, DP.monto_reca, DP.total_bruto, DP.monto_imp, DP.monto_imp2, DP.monto_imp3, DP.otros1,
            DP.otros2, DP.otros3, DP.total_neto / ( CASE WHEN @cCo_Moneda IS NULL THEN 1
                                                         ELSE DP.tasa
                                                    END ) AS total_neto,
            DP.saldo / ( CASE WHEN @cCo_Moneda IS NULL THEN 1
                              ELSE DP.tasa
                         END ) AS saldo, DP.dir_ent, DP.comentario, DP.dis_cen, DP.feccom, DP.numcom, DP.impresa,
            DP.salestax, DP.campo1, DP.campo2, DP.campo3, DP.campo4, DP.campo5, DP.campo6, DP.campo7, DP.campo8,
            DP.co
```
