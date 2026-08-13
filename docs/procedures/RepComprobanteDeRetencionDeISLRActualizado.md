# SP: RepComprobanteDeRetencionDeISLRActualizado
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saAdiCampo`](../tables/saAdiCampo.md)
- [`saBeneficiario`](../tables/saBeneficiario.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saOrdenPago`](../tables/saOrdenPago.md)
- [`saOrdenPagoReng`](../tables/saOrdenPagoReng.md)
- [`saPago`](../tables/saPago.md)
- [`saPagoDocReng`](../tables/saPagoDocReng.md)
- [`saPagoRentenReng`](../tables/saPagoRentenReng.md)
- [`saPagoTPReng`](../tables/saPagoTPReng.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:        SOFTECH SISTEMAS
-- Create date: <18-02-2011>
-- Last Date Update <20-03-2019>
-- Description:   <Comprobante de Retencion de ISLR>
-- =============================================
CREATE PROCEDURE [dbo].[RepComprobanteDeRetencionDeISLRActualizado]
    @sNumero_d CHAR(20) = NULL ,
    @sNumero_h CHAR(20) = NULL ,
	@dFecha_d SMALLDATETIME = NULL ,
    @dFecha_h SMALLDATETIME = NULL ,
    @sCo_Prov_d CHAR(16) = NULL ,
    @sCo_Prov_h CHAR(16) = NULL ,
    @sCo_Bene_d CHAR(10) = NULL,
	@sCo_Bene_h CHAR(10) = NULL, 
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
        
        DECLARE @tipo BIT
        SET @tipo = 0
        
        IF (((@sCo_Prov_d IS NOT NULL) OR (@sCo_Prov_h IS NOT NULL)) AND ((@sCo_Bene_d IS NOT NULL) OR (@sCo_Bene_h IS NOT NULL)))   
        BEGIN
			RAISERROR('No es posible ejecutar el reporte para proveedor y beneficiario a la vez.',16,1)
			RETURN
		END
		
		IF((@sCo_Prov_d IS NOT NULL) OR (@sCo_Prov_h IS NOT NULL) OR
		  (((@sCo_Prov_d IS NULL) AND (@sCo_Prov_h IS NULL)) AND ((@sCo_Bene_d IS NULL) AND (@sCo_Bene_h IS NULL))))
		BEGIN
			SET @tipo = 1
		END
      
      	declare @dir_fis varchar(254)
		
		select @dir_fis=val_str from saAdiCampo where co_adicampo = 'DIR_FIS'
            
        IF @dFecha_d IS NOT NULL 
            SET @dFecha_d = dbo.FechaSimple(@dFecha_d) 
        IF @dFecha_h IS NOT NULL 
            SET @dFecha_h = dbo.FechaSimple(@dFecha_h) 
    
		IF (@tipo = 1)
        BEGIN
        
			SELECT
				A.co_prov, A.prov_des, A.direc1, A.rif, A.nit, DC.fec_emis as fecha, A.cob_num, case S.co_tipo_doc when 'ADEL' then A.mont_cob else DC.total_neto end as mont_cob, A.monto_obj, A.porc_retn,
				A.co_islr, A.sustraendo, A.monto_reten, S.co_tipo_doc, S.nro_fact, DC.total_neto, @dir_fis as dir_fis, DC.n_control  
				, A.fecha_pago
			FROM
				( SELECT
					P.co_prov, P.prov_des, P.direc1, P.rif, P.nit, PA.fecha as fecha_pago, PD.cob_num, PD.rowguid_reng_ori, PD.mont_cob,
					PR.monto_obj, PR.porc_retn, PR.co_islr, PR.sustraendo, PR.monto_reten
				  FROM
					saProveedor P
					INNER JOIN saPago PA ON P.co_prov = PA.co_prov
					--INNER JOIN saPagoTPReng PT ON PT.cob_num = PA.cob_num
					--INNER JOIN saPagoDocReng PD ON PD.cob_num = PT.cob_num
					INNER JOIN saPagoDocReng PD ON PD.cob_num = PA.cob_num AND
```
