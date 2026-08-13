# SP: RepNotaRecepcionCompraxFecha
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saNotaRecepcionCompra`](../tables/saNotaRecepcionCompra.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <05/08/2010>
-- Description:	<Reporte de Notas de Recepción por Fecha>
-- =============================================
CREATE PROCEDURE [RepNotaRecepcionCompraxFecha] 
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
            @cAnulado AS Filtro_anulado, @cImprSubTotal AS SubTotales, 'nota' AS tip_rep, PRO.tip_pro, PRO.prov_des,
            PRO.co_zon, PRO.co_seg, NR.doc_num, NR.descrip, NR.co_prov, NR.co_mone, NR.co_cond, NR.fec_emis, NR.fec_venc,
            NR.fec_reg, NR.anulado, NR.status, NR.n_control, NR.tasa, NR.porc_desc_glob, NR.monto_desc_glob,
            NR.porc_reca, NR.monto_reca, NR.total_bruto, NR.monto_imp, NR.monto_imp2, NR.monto_imp3, NR.otros1,
            NR.otros2, NR.otros3, NR.total_neto / ( CASE WHEN @cCo_Moneda IS NULL THEN 1
                                                         ELSE NR.tasa
                                                    END ) AS total_neto,
            NR.saldo / ( CASE WHEN @cCo_Moneda IS NULL THEN 1
                              ELSE NR.tasa
                         END ) AS saldo, NR.dir_ent, NR.comentario, NR.dis_cen, NR.feccom, NR.numcom, NR.impresa,
            NR.salestax, NR.campo1, NR.campo2, NR.campo3, NR.campo4, NR.campo5, NR.campo6, NR.campo7, NR.campo8,
            NR.co_us_in, NR
```
