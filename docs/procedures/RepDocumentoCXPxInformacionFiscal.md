# SP: RepDocumentoCXPxInformacionFiscal
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <22-02-11>
-- Description:	<Documentos de Compra Con Información Fiscal>
-- =============================================
CREATE PROCEDURE [dbo].[RepDocumentoCXPxInformacionFiscal]
	-- Add the parameters for the stored procedure here
    @sNum_doc_d CHAR(20) = NULL ,
    @sNum_doc_h CHAR(20) = NULL ,
    @sCo_Tip CHAR(6) = NULL ,
    @dFecha_Emis_d DATETIME = NULL ,
    @dFecha_Emis_h DATETIME = NULL ,
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


        IF @dFecha_Emis_h IS NOT NULL 
            SET @dFecha_Emis_h = DATEADD(ss, -60, DATEADD(day, 1, @dFecha_Emis_h))

        DECLARE @fechadiff INT ;
        SET @fechadiff = DATEDIFF(dd, 00, GETDATE()) ;

        SELECT
            '0' AS tipo, DC.nro_doc, 
            
            
			DC.co_tipo_doc, DC.nro_fact, 
			DC.co_prov, 
			dbo.fechasimple(DC.fec_emis) as fec_emis, 
			dbo.fechasimple(DC.fec_venc) as fec_venc, 
			DC.anulado,
            ( DC.otros1 + DC.otros2 + DC.otros3 ) AS otros, DC.doc_orig, DC.nro_orig, DC.tipo_imp, DC.porc_imp,
            DC.fec_reg, ISNULL(DC.n_control, '') AS n_control,
            (DC.total_bruto - (DC.monto_desc_glob + DC.monto_reca)) / ( CASE WHEN @sCo_Moneda IS NULL THEN 1
            ELSE DC.tasa
            END ) AS monto_base,
            DC.total_neto / ( CASE WHEN @sCo_Moneda IS NULL THEN 1
                                   ELSE DC.tasa
                              END ) * ( CASE WHEN DC.anulado = 1 THEN 0
                                             ELSE 1
                                        END ) AS total_neto, DC.tasa, DC.total_bruto, 
			DC.monto_imp / ( CASE WHEN @sCo_Moneda IS NULL THEN 1
            ELSE DC.tasa
            END ) AS monto_imp, P.prov_des,
            TP.descrip, TP.tipo_mov, P.rif
        FROM
            saDocumentoCompra AS DC
            INNER JOIN saP
```
