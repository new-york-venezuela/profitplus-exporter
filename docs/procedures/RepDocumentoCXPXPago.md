# SP: RepDocumentoCXPXPago
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saPago`](../tables/saPago.md)
- [`saPagoDocReng`](../tables/saPagoDocReng.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <24-09-10>
-- Description:	<Documentos de Compra con su Pago>
-- =============================================
CREATE PROCEDURE [dbo].[RepDocumentoCXPXPago]
	-- Add the parameters for the stored procedure here
    @sNum_doc_d CHAR(20) = NULL ,
    @sNum_doc_h CHAR(20) = NULL ,
    @sTipo_doc CHAR(6) = NULL ,
    @dFecha_d DATETIME = NULL ,
    @dFecha_h DATETIME = NULL ,
    @sCo_Prov_d CHAR(16) = NULL ,
    @sCo_Prov_h CHAR(16) = NULL ,
    @sCo_Condic CHAR(4) = NULL ,
    @sCo_Moneda CHAR(6) = NULL ,
    @sCo_Zon_d CHAR(6) = NULL ,
    @sCo_Zon_h CHAR(6) = NULL ,
    @sCo_Seg_d CHAR(6) = NULL ,
    @sCo_Seg_h CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
	
		     IF ( @sDir IS NULL ) 
            SET @sDir = 'ASC'

        IF ( @sCampOrderBy IS NULL ) 
            SET @sCampOrderBy = 'num_doc'


		
        DECLARE @fechadiff INT ;
        SET @fechadiff = DATEDIFF(dd, 00, GETDATE()) ;
 
        IF @dFecha_h IS NOT NULL 
            SET @dFecha_h = DATEADD(ss, -60, DATEADD(day, 1, @dFecha_h))
		/*
		***************************************************************
		Se eliminó de acá la resta de un minuto para la variable @dFecha_d
		***************************************************************
		*/

			
        SELECT
            'Pago' AS tipo, A.*
        FROM
            ( SELECT DISTINCT
                DC.co_prov, 
				P.prov_des, 
				DC.co_tipo_doc, 
				DC.nro_doc, 
				DC.anulado, 
				dbo.fechasimple(DC.fec_emis) as fec_emis, 
				dbo.fechasimple(DC.fec_venc) as fec_venc, 
				DC.observa,
                ( DC.TOTAL_NETO - B.mont_cob_sal ) * ( CASE WHEN TD.tipo_mov = 'DE' THEN 1
                                                            ELSE -1
                                                       END ) AS saldo, 0.00 AS mont_cob, '' AS cob_num, '' AS Fec_pag,
                '' AS anulado_pago, '' AS fecha_Pag, '' AS fecha_emision,
                DC.total_neto * ( CASE WHEN TD.tipo_mov = 'DE' THEN 1
                                       ELSE -1
                                  END ) AS total_neto, DC.co_sucu_in, TD.tipo_mov, DC.nro_orig, DC.doc_orig, DC.co_mone,
                DC.tasa, '' AS forma_pag, '' AS num_doc, 'SI' AS pago_adel
```
