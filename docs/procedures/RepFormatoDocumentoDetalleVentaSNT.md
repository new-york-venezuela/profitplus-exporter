# SP: RepFormatoDocumentoDetalleVentaSNT
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saAdiCampo`](../tables/saAdiCampo.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCobro`](../tables/saCobro.md)
- [`saCobroDocReng`](../tables/saCobroDocReng.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saDocumentoVentaInfoIGTF`](../tables/saDocumentoVentaInfoIGTF.md)
- [`saDocumentoVentaReng`](../tables/saDocumentoVentaReng.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <02/25/2011>
-- Description:	<Reporte de Formato de Documentos con su Detalle Ventas>
-- =============================================

CREATE PROCEDURE [dbo].[RepFormatoDocumentoDetalleVentaSNT] 
                -- Add the parameters for the stored procedure here
    @cCo_Numero_d CHAR(20) = NULL ,
    @cCo_Numero_h CHAR(20) = NULL ,
    @sCo_Tip_d CHAR(6) = NULL ,
    @sCo_Tip_h CHAR(6) = NULL ,
    @cCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

    -- Insert statements for procedure here
	
        DECLARE @Tipo_doc CHAR(11) ;
        SET @Tipo_doc = 'docuventa' ;
                
                               declare @DirFis as nvarchar(254)
                               declare @Telef as nvarchar(254)
                               declare @MonedaBase as char(6)
                               
                               select @DirFis=val_str from saAdiCampo where co_adicampo = 'dir_fis'
                               select @Telef=val_str from saAdiCampo where co_adicampo ='telef'
                               select @MonedaBase=g_moneda from par_emp 
        SELECT
            @Tipo_doc AS TIPO_DOC, 'tipo' = 1, CL.cli_des, CL.rif, CL.telefonos, CL.direc1, CL.direc2, VE.ven_des,
            DV.co_tipo_doc, DV.nro_doc, DV.co_cli, DV.co_ven, DV.co_mone, DV.tasa, DV.observa, DV.fec_emis, DV.fec_venc,
            DV.doc_orig, DV.nro_orig, DV.n_control, DV.total_bruto, DV.monto_imp, DV.monto_desc_glob, DV.porc_desc_glob,
            DV.monto_reca, DV.porc_reca, ( DV.otros1 + DV.otros2 + DV.otros3 ) AS otros, DVR.co_art, 
            DVR.co_uni, isnull(DVR.prec_vta,DV.total_bruto) as 'prec_vta', 
			DV.aut,
                                               ( CASE WHEN DVR.porc_desc IS NULL THEN 0.00 END ) AS porc_desc,
                                               isnull(DVR.porc_imp,DV.porc_imp) as 'porc_imp', isnull(DVR.reng_neto,DV.total_bruto) as 'reng_neto',
                                               --CC 11-02-25
                                               isnull(DVR.total_art,1) as 'total_art',
                                               CASE ISNULL(DVR.co_art,'')+ISNULL(ART.art_des,'') WHEN '' THEN ISNULL(dv.observa,'---')
                                               ELSE rTRIM(ISNU
```
