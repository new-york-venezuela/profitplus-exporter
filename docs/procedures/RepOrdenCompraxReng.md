# SP: RepOrdenCompraxReng
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saOrdenCompra`](../tables/saOrdenCompra.md)
- [`saOrdenCompraReng`](../tables/saOrdenCompraReng.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <31/05/2021>
-- Description:	<Reporte de Ordenes de Compra con sus Renglones>
-- =============================================
CREATE PROCEDURE [dbo].[RepOrdenCompraxReng]
    @cCo_Numero_d CHAR(20) = NULL ,
    @cCo_Numero_h CHAR(20) = NULL ,
    @sCo_fecha_d SMALLDATETIME = NULL ,
    @sCo_fecha_h SMALLDATETIME = NULL ,
    @cCo_Prov_d CHAR(16) = NULL ,
    @cCo_Prov_h CHAR(16) = NULL ,
    @cCo_Linea_d CHAR(6) = NULL ,
    @cCo_Linea_h CHAR(6) = NULL ,
    @cCo_SubLinea_d CHAR(6) = NULL ,
    @cCo_SubLinea_h CHAR(6) = NULL ,
    @cCo_Categoria_d CHAR(6) = NULL ,
    @cCo_Categoria_h CHAR(6) = NULL ,
    @cStatus CHAR(6) = NULL ,
    @cAnulado CHAR(6) = NULL ,
    @cCo_Sucursal CHAR(6) = NULL ,
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

-------------------------------
        IF ( @cStatus IS NULL ) 
            SET @cStatus = 'TODO'
        IF ( @cAnulado IS NULL ) 
            SET @cAnulado = 'TODO'
-------------------------------

        SELECT
            @cAnulado AS Filtro_anulado, 'orden' AS tip_rep, ART.art_des, ART.modelo, ART.co_lin, ART.co_subl,
            ART.co_cat, P.prov_des, CP.cond_des, FC.doc_num, FC.nro_fact, FC.descrip, FC.co_prov, FC.co_mone, FC.co_cond,
            FC.porc_desc_glob, FC.porc_reca, FC.status, FC.n_control, FC.fec_emis, FC.fec_venc, FC.fec_reg, FC.tasa,
            FC.saldo, FC.total_bruto, FC.total_neto, FC.monto_desc_glob, FC.monto_reca, FC.otros1, FC.otros2, FC.otros3,
            FC.monto_imp, FC.monto_imp2, FC.monto_imp3, FC.anulado, FC.impresa, /*FC.seriales_e,*/ FC.salestax,
            FC.dis_cen, FC.feccom, FC.numcom, FC.dir_ent, FC.comentario, FC.campo1, FC.campo2, FC.campo3, FC.campo4,
            FC.campo5, FC.campo6, FC.campo7, FC.campo8, FC.co_us_in, FC.co_sucu_in, FC.fe_us_in, FC.co_us_mo,
            FC.co_sucu_mo, FC.fe_us_mo, FC.revisado, FC.trasnfe, FC.validador, FC.rowguid, FVR.reng_num, FVR.doc_num,
            FVR.co_art, FVR.des_art, AU.co_uni, FVR.sco_uni, FVR.co_alma, FVR.tipo_imp, FVR.tipo_imp2, FVR.tipo_imp3,
            FVR.tipo_doc, FVR.porc_desc, FVR.num_doc, FVR
```
