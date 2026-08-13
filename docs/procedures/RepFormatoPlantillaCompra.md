# SP: RepFormatoPlantillaCompra
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saPlantillaCompra`](../tables/saPlantillaCompra.md)
- [`saPlantillaCompraReng`](../tables/saPlantillaCompraReng.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <25/08/2010>
-- Description:	<Reporte de Formato de Plantilla de Compra>
-- =============================================
CREATE PROCEDURE [dbo].[RepFormatoPlantillaCompra]
    @cCo_Numero_d CHAR(20) = NULL ,
    @cCo_Numero_h CHAR(20) = NULL ,
    @cCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        DECLARE @Tipo_doc CHAR(11) ;
        SET @Tipo_doc = 'plancompra' ;
	
        SELECT
            @Tipo_doc AS TIPO_DOC, 'tipo' = 0, ART.modelo, ( P.prov_des ) AS cli_des, P.rif, P.nit, P.telefonos, P.fax,
            P.direc1, (CASE WHEN (FC.dir_ent IS NOT NULL AND len(ltrim(FC.dir_ent)) > 0) THEN FC.dir_ent ELSE P.direc2 END) AS dir_entrega,
            CP.cond_des, MO.mone_des, FC.doc_num, FC.nro_fact, FC.descrip,
            ( FC.co_prov ) AS co_cli, FC.co_mone, FC.co_cond, FC.porc_desc_glob, FC.porc_reca, FC.status, FC.n_control,
            FC.fec_emis, FC.fec_venc, FC.fec_reg, FC.tasa, FC.saldo, FC.total_bruto, FC.total_neto, FC.monto_desc_glob,
            FC.monto_reca, FC.otros1, FC.otros2, FC.otros3, FC.monto_imp, FC.monto_imp2, FC.monto_imp3, FC.anulado,
            FC.impresa, /*FC.seriales_e,*/ FC.salestax, FC.dis_cen, FC.feccom, FC.numcom, FC.dir_ent, FC.comentario,
            FC.campo1, FC.campo2, FC.campo3, FC.campo4, FC.campo5, FC.campo6, FC.campo7, FC.campo8, FC.co_us_in,
            FC.co_sucu_in, FC.fe_us_in, FC.co_us_mo, FC.co_sucu_mo, FC.fe_us_mo, FC.revisado, FC.trasnfe, FC.validador,
            FC.rowguid, FVR.reng_num, FVR.doc_num, FVR.co_art, ISNULL(FVR.des_art, ART.art_des) as des_art, FVR.co_uni, FVR.sco_uni, FVR.co_alma,
            FVR.tipo_imp, FVR.tipo_imp2, FVR.tipo_imp3, FVR.tipo_doc, FVR.porc_desc, FVR.num_doc, FVR.rowguid_doc,
            FVR.reng_neto, ( FVR.cost_unit ) AS prec_vta, FVR.cost_unit_om, FVR.total_art, FVR.stotal_art, FVR.otros,
            FVR.porc_imp, FVR.porc_imp2, FVR.porc_imp3, FVR.monto_imp, FVR.monto_imp2, FVR.monto_imp3, FVR.porc_gas,
            FVR.total_dev, FVR.monto_dev, FVR.lote_asignado, FVR.monto_desc, FVR.pendiente, FVR.pendiente2,
            FVR.comentario, FVR.costo_adi1, FVR.costo_adi2, FVR.costo_adi3, FVR.dis_cen, FVR.co_sucu_in, FVR.co_us_in,
            FVR.fe_us_in, FVR.co_sucu_mo, FVR.co_us_mo, FVR.fe_us_mo, FVR.revisado, FVR.trasnfe, FVR.
```
