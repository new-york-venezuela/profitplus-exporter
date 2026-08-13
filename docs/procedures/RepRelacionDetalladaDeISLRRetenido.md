# SP: RepRelacionDetalladaDeISLRRetenido
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
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
-- Create date: <10-26-2010>
-- Description:   <Relación detallada de ISLR Retenido>
-- =============================================
CREATE PROCEDURE [dbo].[RepRelacionDetalladaDeISLRRetenido]
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
             
        IF @dFecha_d IS NOT NULL 
            SET @dFecha_d = dbo.FechaSimple(@dFecha_d) 
        IF @dFecha_h IS NOT NULL 
            SET @dFecha_h = dbo.FechaSimple(@dFecha_h) 
    
        IF (@tipo = 1)
        BEGIN
			SELECT
				P.rif, P.prov_des, P.direc1, PA.fecha, 
				/*Se comento el campo: PT.num_doc y la relacion de abajo debido a que cuando el pago se realizaba con mas de 
				una forma de pago salian los registros duplicados en el reporte. Por lo tanto se incluyo una subconsulta para que buscara
				la primera forma de pago que tuviera el num_doc (cheque). */
				(SELECT TOP(1) ISNULL(num_doc, NULL) FROM saPagoTPReng WHERE cob_num= PA.cob_num AND num_doc IS NOT NULL) AS num_doc, 
				PR.co_islr, PD.mont_cob, PD1.nro_fact, PR.monto_obj,
				PR.porc_retn, PR.sustraendo, PR.monto_reten, DC.n_control  
			FROM
				saProveedor P
				INNER JOIN saPago PA ON P.co_prov = PA.co_prov
				
				--INNER JOIN saPagoTPReng PT ON PT.cob_num = PA.cob_num
				INNER JOIN saPagoDocReng PD ON PD.cob_num = PA.cob_num AND PD.co_tipo_doc = 'ISLR'
				INNER JOIN saPagoDocReng PD1 ON PD.rowguid_reng_ori = PD1.rowguid
				INNER JOIN saPagoRentenReng PR ON PD.rowguid = PR.rowguid_reng_cob
				LEFT JOIN saDocumentoCompra DC ON DC.co_tipo_doc = PD1.co_tipo_doc
```
