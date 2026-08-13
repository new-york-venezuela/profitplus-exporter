# SP: RepFormatoFacturaCompraOM_NCF
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saNCFInfoDocCompra`](../tables/saNCFInfoDocCompra.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saSerie`](../tables/saSerie.md)
- [`saSerieTipo`](../tables/saSerieTipo.md)
- [`saSerieTipoExt`](../tables/saSerieTipoExt.md)
- [`saTipoComprobante`](../tables/saTipoComprobante.md)
- [`saTipoGasto`](../tables/saTipoGasto.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <30/05/2019>
-- Description:	Reporte para Facturas de Compra NCF (Dominicana) en Otra Moneda.
-- =============================================
CREATE PROCEDURE [dbo].[RepFormatoFacturaCompraOM_NCF]
    @sCo_Numero_d CHAR(20) = NULL ,
    @sCo_Numero_h CHAR(20) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        DECLARE @Tipo_doc CHAR(11) ;
        SET @Tipo_doc = 'factcompra' ;
	
        SELECT
            @Tipo_doc AS TIPO_DOC, 'tipo' = 0, ART.modelo, ( P.prov_des ) AS cli_des, P.rif, P.nit, P.telefonos, P.fax,
            P.direc1,NCF.ncf,G.co_gasto,G.des_tipo,C.co_tipo,C.des_tipo, CONVERT(char,SEXT.fe_venc,103)as fe_venc,
			
			 (CASE WHEN (FC.dir_ent IS NOT NULL AND len(ltrim(FC.dir_ent)) > 0) THEN FC.dir_ent ELSE P.direc2 END) AS dir_entrega,
            CP.cond_des, MO.mone_des, FC.doc_num, FC.nro_fact, FC.descrip,
            ( FC.co_prov ) AS co_cli, FC.co_mone, FC.co_cond, FC.porc_desc_glob, FC.porc_reca, FC.status, FC.n_control,
           CONVERT(char,FC.fec_emis,103)as fec_emis, CONVERT(char,FC.fec_venc,103)as fec_venc, FC.fec_reg, FC.tasa, FC.saldo, FC.total_bruto / FC.tasa AS total_bruto,
            FC.total_neto / FC.tasa AS total_neto, FC.monto_desc_glob / FC.tasa AS monto_desc_glob,
            FC.monto_reca / FC.tasa AS monto_reca, FC.otros1 / FC.tasa AS otros1, FC.otros2 / FC.tasa AS otros2,
            FC.otros3 / FC.tasa AS otros3, FC.monto_imp / FC.tasa AS monto_imp, FC.monto_imp2 / FC.tasa AS monto_imp2,
            FC.monto_imp3 / FC.tasa AS monto_imp, FC.anulado, FC.impresa, /*FC.seriales_e,*/ FC.salestax, FC.dis_cen,
            FC.feccom, FC.numcom, FC.dir_ent, FC.comentario, FC.campo1, FC.campo2, FC.campo3, FC.campo4, FC.campo5,
            FC.campo6, FC.campo7, FC.campo8, FC.co_us_in, FC.co_sucu_in, FC.fe_us_in, FC.co_us_mo, FC.co_sucu_mo,
            FC.fe_us_mo, FC.revisado, FC.trasnfe, FC.validador, FC.rowguid, FVR.reng_num, FVR.doc_num, FVR.co_art,
            CASE WHEN FVR.des_art IS NOT NULL THEN FVR.des_art
                 ELSE ART.art_des
            END des_art, FVR.co_uni, FVR.sco_uni, FVR.co_alma, FVR.tipo_imp, FVR.tipo_imp2, FVR.tipo_imp3, FVR.tipo_doc,
            FVR.porc_desc, FVR.num_doc, FVR.rowguid_doc, FVR.reng_neto / FC.tasa AS reng_neto,
            FVR.cost_unit / FC.tasa AS pre
```
