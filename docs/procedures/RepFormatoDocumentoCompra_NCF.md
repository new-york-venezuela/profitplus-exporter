# SP: RepFormatoDocumentoCompra_NCF
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saNCFInfoDocCompra`](../tables/saNCFInfoDocCompra.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saSerie`](../tables/saSerie.md)
- [`saSerieTipo`](../tables/saSerieTipo.md)
- [`saSerieTipoExt`](../tables/saSerieTipoExt.md)
- [`saTipoComprobante`](../tables/saTipoComprobante.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)
- [`saTipoGasto`](../tables/saTipoGasto.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <30/05/2019>
-- Description:	Reporte para Documento de Compra NCF (Dominicana).
-- =============================================
CREATE PROCEDURE [dbo].[RepFormatoDocumentoCompra_NCF] 
	-- Add the parameters for the stored procedure here
    @cCo_Numero_d CHAR(20) = NULL ,
    @cCo_Numero_h CHAR(20) = NULL ,
    @sCo_Tip_d CHAR(6) = NULL ,
    @sCo_Tip_h CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;


	
        SELECT
            'docucompra' AS TIPO_DOC, 'tipo' = 0, ( CL.prov_des ) AS cli_des,DV.nro_fact, CL.rif, CL.telefonos, CL.direc1, CL.direc2,CL.respons as camp, --VE.ven_des, 
            DV.co_tipo_doc,TD.descrip, DV.nro_doc, ( DV.co_prov ) AS co_cli, /*DV.co_ven,*/ DV.co_mone, DV.tasa, DV.observa,
            DV.fec_emis, DV.fec_venc, DV.doc_orig, DV.nro_orig, DV.n_control, DV.total_bruto, DV.monto_imp,
            DV.monto_desc_glob, DV.porc_desc_glob, DV.monto_reca, DV.porc_reca,
            ( DV.otros1 + DV.otros2 + DV.otros3 ) AS otros, null fec_emis_ori, null total_bruto_ori, null monto_imp_ori, null total_neto_ori,CL.fax,NCF.ncf,G.co_gasto,
			G.des_tipo,C.co_tipo,C.des_tipo, CONVERT(char,SEXT.fe_venc,103)as fe_venc,CL.direc1,  NCF.nro_doc_Ori, NCFF.ncf as ncf_afectado			
        FROM
            saDocumentoCompra AS DV
			left join saTipoDocumento TD ON TD.co_tipo_doc = DV.co_tipo_doc
            INNER JOIN saProveedor AS CL ON CL.co_prov = DV.co_prov	

		   --osunaw--
		   
		 	LEFT JOIN saNCFInfoDocCompra NCF ON NCF.nro_doc = DV.nro_doc AND NCF.tipo_doc = DV.co_tipo_doc
			LEFT JOIN 
					(
						select tipo_doc, nro_doc,ncf, tipo_doc_Ori, nro_doc_Ori from saNCFInfoDocCompra
					)  NCFF on NCFF.nro_doc = ncf.nro_doc_Ori AND NCFF.tipo_doc = NCF.tipo_doc_Ori
			
			LEFT JOIN saTipoGasto G on G.co_gasto = NCF.co_gasto
				LEFT JOIN saSerie  S ON S.co_serie = NCF.co_serie
					LEFT JOIN saSerieTipo ST ON ST.co_tipo_serie = S.co_tipo_serie
						LEFT JOIN saSerieTipoExt SEXT on SEXT.rowguid_serietipo = ST.rowguid
							LEFT JOIN saTipoComprobante C on C.co_tipo = SEXT.co_tipo  
								LEFT JOIN saFacturaCompra as FC ON FC.doc_num = DV.nro_doc


        WHERE
            ( ( @cCo_Numero_d IS NULL
                OR DV.nro_doc >= @cCo_Numero_d
              )
             AND ( @cCo_Numero_h IS NULL
```
