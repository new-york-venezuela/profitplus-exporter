# SP: RepCompraxProveedor
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <05/08/2010>
-- Description:	<Reporte de Compras por Proveedor >
-- =============================================
CREATE PROCEDURE [dbo].[RepCompraxProveedor] 
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

        IF @dCo_fecha_h IS NOT NULL 
            SET @dCo_fecha_h = DATEADD(ss, -60, DATEADD(day, 1, @dCo_fecha_h))

-- Insert statements for procedure here
-------------------------------
        IF ( @cStatus IS NULL ) 
            SET @cStatus = 'TODO'
        IF ( @cAnulado IS NULL ) 
            SET @cAnulado = 'TODO'
-------------------------------

        SELECT
            @cAnulado AS Filtro_anulado, 'compra' AS tip_rep, PRO.tip_pro, PRO.prov_des, PRO.co_zon, PRO.co_seg,
            FC.doc_num, FC.descrip, FC.co_prov, FC.co_mone, FC.co_cond, FC.fec_emis, FC.fec_venc, FC.fec_reg, FC.anulado,
            FC.status, FC.n_control, FC.tasa, FC.porc_desc_glob, FC.monto_desc_glob, FC.porc_reca, FC.monto_reca,
            FC.total_bruto, FC.monto_imp, FC.monto_imp2, FC.monto_imp3, FC.otros1, FC.otros2, FC.otros3,
            FC.total_neto / ( CASE WHEN @cCo_Moneda IS NULL THEN 1
                                   ELSE FC.tasa
                              END ) AS total_neto, FC.saldo / ( CASE WHEN @cCo_Moneda IS NULL THEN 1
                                                                     ELSE FC.tasa
                                                                END ) AS saldo, FC.dir_ent, FC.comentario, FC.dis_cen,
            FC.feccom, FC.numcom, FC.impresa, FC.salestax, FC.campo1, FC.campo2, FC.campo3, FC.campo4, FC.campo5,
            FC.campo6, FC.campo7, FC.campo8, FC.co_us_in, FC.co_sucu_in, FC.fe_us_in, FC.co_us_mo, FC.co_sucu_mo,
            FC.fe_us_mo, FC.revisado,
```
