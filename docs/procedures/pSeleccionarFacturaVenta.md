# SP: pSeleccionarFacturaVenta
**Tipo**: Seleccionar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saDocumentoVentaInfoIGTF`](../tables/saDocumentoVentaInfoIGTF.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saNCFInfoDocVenta`](../tables/saNCFInfoDocVenta.md)
- [`saSerie`](../tables/saSerie.md)
- [`saSerieTipo`](../tables/saSerieTipo.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pSeleccionarFacturaVenta
*DESCRIPCIÓN	: Selecciona una factura de venta
*AUTOR			: SOFTECH SISTEMAS
*FECHA ACTUALIZACIÓN: 2019-04-29
*************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarFacturaVenta] ( @sDoc_Num CHAR(20) )
AS 
    BEGIN

        SELECT
            --v.*, 
			 v.doc_num  ,v.descrip  ,v.co_cli  ,v.co_tran  ,v.co_mone 
			 ,v.co_ven  ,v.co_cond  ,v.fec_emis  ,v.fec_venc  ,v.fec_reg 
			 ,v.anulado  ,v.status  ,v.n_control  ,v.ven_ter  ,v.tasa 
			 ,v.porc_desc_glob  ,v.monto_desc_glob  ,v.porc_reca  ,v.monto_reca 
			 ,v.total_bruto  ,v.monto_imp  ,v.monto_imp2  ,v.monto_imp3 
			 ,v.otros1 
			 --,case when (DVIG.porc_aplic >0) then 0 else v.otros1 END  as otros1
			 ,v.otros2  ,v.otros3  ,v.total_neto  ,v.saldo  ,v.dir_ent  ,v.comentario 
			 ,v.dis_cen  ,v.feccom  ,v.numcom  ,v.contrib  ,v.impresa  ,v.seriales_s 
			 ,v.salestax  ,DV.impfis  ,DV.impfisfac  ,DV.imp_nro_z  ,v.campo1  ,v.campo2 
			 ,v.campo3  ,v.campo4  ,v.campo5  ,v.campo6  ,v.campo7  ,v.campo8 
			 ,v.co_us_in  ,v.co_sucu_in  ,v.fe_us_in  ,v.co_us_mo  ,v.co_sucu_mo 
			,v.fe_us_mo  ,v.revisado  ,v.trasnfe  ,v.validador  ,v.rowguid  ,v.co_cta_ingr_egr 
			,c.sincredito, c.dir_ent2, c.plaz_pag, c.desc_glob, c.co_ven, c.tip_cli, NCF.ncf as NumeroControlFiscal, 
			NCF.co_anulacion AS co_anulacion, NCF.co_serie AS co_serie, ST.des_tipo_serie AS des_tipo_serie, 
			NCF.tipo_doc_Ori AS tipo_doc_ori, NCF.nro_doc_Ori AS nro_doc_Ori, 
			isnull(DVIG.base_imponible,0) as base_imponible, ISNULL(DVIG.porc_aplic,0) as porc_aplic --DN280422
        FROM
            saFacturaVenta v
            INNER JOIN saCliente c ON v.co_cli = c.co_cli
			LEFT JOIN saNCFInfoDocVenta NCF ON NCF.nro_doc = V.doc_num AND NCF.tipo_doc = 'FACT'
			LEFT JOIN saSerie SE ON NCF.co_serie = SE.co_serie
			LEFT JOIN saSerieTipo ST ON SE.co_tipo_serie = ST.co_tipo_serie
			LEFT JOIN saDocumentoVenta DV ON v.doc_num = DV.nro_doc AND DV.co_tipo_doc = 'FACT'--DN280422
			LEFT JOIN saDocumentoVentaInfoIGTF DVIG ON DV.rowguid = DVIG.rowguid--DN280422
        WHERE
            doc_num = @sDoc_Num

    END
```
