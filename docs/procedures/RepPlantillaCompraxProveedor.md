# SP: RepPlantillaCompraxProveedor
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saPlantillaCompra`](../tables/saPlantillaCompra.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <05/08/2010>
-- Description:	<Reporte de Plantillas de Compra por Proveedor >
-- =============================================
CREATE PROCEDURE [RepPlantillaCompraxProveedor] 
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
            @cAnulado AS Filtro_anulado, 'planti' AS tip_rep, PRO.tip_pro, PRO.prov_des, PRO.co_zon, PRO.co_seg,
            PC.doc_num, PC.descrip, PC.co_prov, PC.co_mone, PC.co_cond, PC.fec_emis, PC.fec_venc, PC.fec_reg, PC.anulado,
            PC.status, PC.n_control, PC.tasa, PC.porc_desc_glob, PC.monto_desc_glob, PC.porc_reca, PC.monto_reca,
            PC.total_bruto, PC.monto_imp, PC.monto_imp2, PC.monto_imp3, PC.otros1, PC.otros2, PC.otros3,
            PC.total_neto / ( CASE WHEN @cCo_Moneda IS NULL THEN 1
                                   ELSE PC.tasa
                              END ) AS total_neto, PC.saldo / ( CASE WHEN @cCo_Moneda IS NULL THEN 1
                                                                     ELSE PC.tasa
                                                                END ) AS saldo, PC.dir_ent, PC.comentario, PC.dis_cen,
            PC.feccom, PC.numcom, PC.impresa, PC.salestax, PC.campo1, PC.campo2, PC.campo3, PC.campo4, PC.campo5,
            PC.campo6, PC.campo7, PC.campo8, PC.co_us_in
```
