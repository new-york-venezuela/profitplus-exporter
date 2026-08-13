# SP: pSeleccionarContabilizacionIVAPositivoCompra
**Tipo**: Seleccionar
**Módulo**: Compras

## Tablas Referenciadas
- [`saCobroDocReng`](../tables/saCobroDocReng.md)
- [`saCuentaIngEgr`](../tables/saCuentaIngEgr.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saDocumentoCompraReng`](../tables/saDocumentoCompraReng.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: 	 pSeleccionarContabilizacionIVAPositivoCompra
DESCRIPCION	:Selecciona los documentos de contabilización de IVA positivo no contabilizados
CREADO POR	:SOFTECH SISTEMAS
CREADO EL	:2019/11/21
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarContabilizacionIVAPositivoCompra]
       (
      @sdFechaDesde SMALLDATETIME ,
      @sdFechHasta SMALLDATETIME ,
      @sCo_Sucu_Desde CHAR(6) = NULL ,
      @sCo_Sucu_Hasta CHAR(6) = NULL ,
      @bDocnoint BIT --Documentos no Contabilizados
       
    )
AS 
    BEGIN
        IF @sdFechaDesde IS NOT NULL 
            SET @sdFechaDesde = dbo.FechaSimple(@sdFechaDesde)
        IF @sdFechHasta IS NOT NULL 
            SET @sdFechHasta = dbo.FechaSimple(@sdFechHasta)
        SELECT 
             --(RTRIM(DV.co_tipo_doc) + 
            ( RTRIM(DV.nro_doc) ) AS Co_Doc, P.co_prov AS Co_Auxiliar, P.prov_des AS Descrip_Auxiliar, DV.nro_doc, DV.co_tipo_doc,
            DV.co_prov, /*DV.co_ven,*/ DV.co_mone, DV.mov_ban, DV.tasa, DV.tipo_origen, DV.observa, DV.fec_reg, DV.fec_emis,
            DV.fec_venc, DV.anulado, DV.aut, /*DV.contrib,*/ DV.doc_orig, DV.nro_orig, DV.nro_che, DV.monto_imp, DV.saldo,
            DV.total_bruto, DV.monto_desc_glob, DV.porc_desc_glob, DV.porc_reca, DV.monto_reca, DV.total_neto,
            DV.monto_imp2, DV.monto_imp3, DV.tipo_imp, DV.porc_imp, DV.num_comprobante, DV.feccom, DV.numcom,
            DV.n_control, DV.dis_cen AS dis_cen_saDocumentoCompra, --DV.comis1, DV.comis2, DV.comis3, DV.comis4, DV.comis5,
            /*DV.comis6,*/ DV.adicional, DV.salestax, DV.doc_orig, DV.nro_orig, --DV.ven_ter, DV.impfis, DV.impfisfac,
            DV.otros1, DV.otros2, DV.otros3, DV.campo1, DV.campo2, DV.campo3, DV.campo4, DV.campo5, DV.campo6, DV.campo7,
            DV.campo8, DV.co_us_in, DV.co_sucu_in AS Co_Sucu_Cont, DV.fe_us_in, DV.co_us_mo, DV.co_sucu_mo, DV.fe_us_mo,
            DV.revisado, DV.trasnfe, DV.validador, DV.rowguid, P.dis_cen AS dis_cen_saProveedor, P.prov_des AS ProveedorDes,
            CONVERT(bit, ISNULL(DVR.tiene, 0)) AS tiene_reng,CTDoc.dis_cen AS dis_cen_saCtaIngEgr_Doc,CTDoc.co_cta_ingr_egr AS Cta_Ingr_Egr_Doc,
            CTPro.co_cta_ingr_egr AS cta_ingr_egr_prov,    CTPro.dis_cen AS dis_cen_saCtaIngEgr_Prov,
            RTRIM(
```
