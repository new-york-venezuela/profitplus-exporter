# SP: RepCotizacionProveedorxProveedor
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saCotizacionProveedor`](../tables/saCotizacionProveedor.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <05/08/2010>
-- Description:	<Reporte de Cotizaciones de Proveedores por Proveedor >
-- =============================================
CREATE PROCEDURE [RepCotizacionProveedorxProveedor] 
	-- Add the parameters for the stored procedure here
    @cCo_Numero_d CHAR(20) = NULL ,
    @cCo_Numero_h CHAR(20) = NULL ,
    @dCo_fecha_d SMALLDATETIME = NULL ,
    @dCo_fecha_h SMALLDATETIME = NULL ,
    @cCo_Proveedor_d CHAR(16) = NULL ,
    @cCo_Proveedor_h CHAR(16) = NULL ,
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
            @cAnulado AS Filtro_anulado, 'coti' AS tip_rep, PRO.tip_pro, PRO.prov_des, PRO.co_zon, PRO.co_seg,
            CP.doc_num, CP.descrip, CP.co_prov, CP.co_mone, CP.co_cond, CP.fec_emis, CP.fec_venc, CP.fec_reg, CP.anulado,
            CP.status, CP.n_control, CP.tasa, CP.porc_desc_glob, CP.monto_desc_glob, CP.porc_reca, CP.monto_reca,
            CP.total_bruto, CP.monto_imp, CP.monto_imp2, CP.monto_imp3, CP.otros1, CP.otros2, CP.otros3,
            CP.total_neto / ( CASE WHEN @cCo_Moneda IS NULL THEN 1
                                   ELSE CP.tasa
                              END ) AS total_neto, CP.saldo / ( CASE WHEN @cCo_Moneda IS NULL THEN 1
                                                                     ELSE CP.tasa
                                                                END ) AS saldo, CP.dir_ent, CP.comentario, CP.dis_cen,
            CP.feccom, CP.numcom, CP.impresa, CP.salestax, CP.campo1, CP.campo2, CP.campo3, CP.campo4, CP.campo5,
            CP.campo6, CP.campo7, CP.campo8, C
```
