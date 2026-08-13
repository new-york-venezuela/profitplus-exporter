# SP: RepFormatoCotizacionClienteArtComp
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saAdiCampo`](../tables/saAdiCampo.md)
- [`saArtCompuesto`](../tables/saArtCompuesto.md)
- [`saArtCompuestoReng`](../tables/saArtCompuestoReng.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saCotizacionCliente`](../tables/saCotizacionCliente.md)
- [`saCotizacionClienteReng`](../tables/saCotizacionClienteReng.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saTransporte`](../tables/saTransporte.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <01/12/2017>
-- Description:	<Reporte de Formato Cotizacion Cliente Articulo Compuesto>
-- =============================================
CREATE PROCEDURE [dbo].[RepFormatoCotizacionClienteArtComp] 
    @cCo_Numero_d CHAR(20) = NULL ,
    @cCo_Numero_h CHAR(20) = NULL ,
    @cCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
BEGIN
    SET NOCOUNT ON ;

    DECLARE @DirFis NVARCHAR(254)
    DECLARE @Telef NVARCHAR(254)
    DECLARE @MonedaBase CHAR(6)

    SELECT @DirFis = val_str FROM saAdiCampo WHERE co_adicampo = 'dir_fis'
    SELECT @Telef = val_str FROM saAdiCampo WHERE co_adicampo = 'telef'
    SELECT @MonedaBase = g_moneda FROM par_emp

    SELECT  
        ART.modelo, CL.cli_des, CL.rif, CL.nit, CL.telefonos, CL.fax, CL.direc1,
        (CASE WHEN (CC.dir_ent IS NOT NULL AND LEN(LTRIM(CC.dir_ent)) > 0) 
              THEN CC.dir_ent ELSE CL.dir_ent2 END) AS dir_entrega, 
        VE.ven_des, TR.des_tran, CP.cond_des, MO.mone_des,

        /*Campos saCotizacionCliente*/
        CC.doc_num, CC.co_cli, CC.co_tran, CC.co_mone, CC.co_ven, CC.co_cond,
        CC.descrip, CC.fec_emis, CC.fec_venc, CC.fec_reg, CC.anulado, CC.status, CC.n_control, CC.tasa,
        CC.porc_desc_glob, CC.monto_desc_glob, CC.porc_reca, CC.monto_reca, CC.total_bruto, CC.monto_imp,
        CC.monto_imp2, CC.monto_imp3, CC.otros1, CC.otros2, CC.otros3, CC.total_neto, CC.saldo, CC.dir_ent,
        CC.comentario, CC.contrib, CC.seriales_s, CC.salestax, CC.impfis, CC.impfisfac, 

        /*Campos saCotizacionClienteReng*/
        CCR.reng_num, CCR.co_art, CCR.des_art, CCR.co_alma, CCR.total_art,
        CCR.stotal_art, CCR.co_uni, CCR.sco_uni, CCR.co_precio, CCR.prec_vta, CCR.prec_vta_om, CCR.porc_desc,
        CCR.monto_desc, CCR.tipo_imp, CCR.tipo_imp2, CCR.tipo_imp3, CCR.porc_imp, CCR.porc_imp2, CCR.porc_imp3,
        CCR.monto_imp, CCR.monto_imp2, CCR.monto_imp3, CCR.reng_neto, CCR.pendiente, CCR.pendiente2, 
        (CASE WHEN CCR.tipo_doc IS NULL THEN 'CCLI' ELSE CCR.tipo_doc END) AS tipo_doc,
        CCR.num_doc, CCR.rowguid_doc, CCR.total_dev, CCR.monto_dev, CCR.otros, CCR.comentario, CCR.lote_asignado, 
        ART.art_des, 

        /*Campos saArtCompuesto*/
        0 AS kreng_num,

        @DirFis AS DirFis,
        @Telef AS Telef,
        @MonedaBase AS Mone
```
