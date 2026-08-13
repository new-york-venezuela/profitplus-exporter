# SP: RepComprobanteDeRetencionesVarias
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saAdiCampo`](../tables/saAdiCampo.md)
- [`saBeneficiario`](../tables/saBeneficiario.md)
- [`saOrdenPago`](../tables/saOrdenPago.md)
- [`saOrdenPagoReng`](../tables/saOrdenPagoReng.md)
- [`saPago`](../tables/saPago.md)
- [`saPagoDocReng`](../tables/saPagoDocReng.md)
- [`saPagoRentenReng`](../tables/saPagoRentenReng.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:        SOFTECH SISTEMAS
-- Create date: <10-26-2010>
-- Description:   <Comprobante de Retenciones Varias>
-- =============================================
CREATE PROCEDURE [dbo].[RepComprobanteDeRetencionesVarias]
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
    ------------------------------------------------
		declare @dir_fis varchar(254)
		
		select @dir_fis=val_str from saAdiCampo where co_adicampo = 'DIR_FIS'

		declare @telef varchar(254)

		select @telef =val_str from saAdiCampo where co_adicampo = 'TELEF'
	------------------------------------------------
        IF @dFecha_d IS NOT NULL 
            SET @dFecha_d = dbo.FechaSimple(@dFecha_d)
        IF @dFecha_h IS NOT NULL 
            SET @dFecha_h = dbo.FechaSimple(@dFecha_h)
           
		
		IF (@tipo = 1)
        BEGIN
        
			SELECT
				DAY(( dbo.UltimoDiaMes(E.mes, E.anho) )) AS dia, E.*
			FROM
            ( SELECT
                MONTH(PA.fecha) AS mes, YEAR(PA.fecha) AS anho,
                CASE WHEN P.tipo_per = '1' THEN 'Natural Residente'
                     WHEN P.tipo_per = '2' THEN 'Natural No Residente'
                     WHEN P.tipo_per = '3' THEN 'Jurídica Domiciliada'
                     WHEN P.tipo_per = '4' THEN 'Jurídica No Domiciliada'
                     WHEN P.tipo_per = '5' THEN 'Exenta'
                     WHEN P.tipo_per = '6' THEN 'Tesorería Nacional'
                     WHEN P.tipo_per = '7' THEN 'Otros 1'
                     WHEN P.tipo_per = '8' THEN 'Otros 2'
                     ELSE ''
                END AS tipo_pe
```
