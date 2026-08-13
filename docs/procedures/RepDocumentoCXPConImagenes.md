# SP: RepDocumentoCXPConImagenes
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)
- [`saTipoImagen`](../tables/saTipoImagen.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <02-08-10>
-- Description:	<Documentos de Compra por Numero>
-- =============================================
CREATE PROCEDURE [dbo].[RepDocumentoCXPConImagenes]
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
	@sCo_tipo_img_d char(6) = NULL,
	@sCo_tipo_img_h char(6) = NULL,
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
            DC.nro_doc, DC.co_tipo_doc, DC.nro_fact, DC.co_prov, DC.fec_emis, DC.fec_venc, DC.anulado,  
			DC.tasa, DC.total_bruto, DC.monto_imp, P.prov_des, TP.descrip,
            TP.tipo_mov, 
			  DI.co_imag, DI.des_imag, DI.picture, TI.co_tipo_imag, TI.descrip as descripImagen
        FROM
            saDocumentoCompra AS DC
            INNER JOIN saProveedor AS P ON P.co_prov = DC.co_prov
            LEFT JOIN saTipoDocumento AS TP ON TP.co_tipo_doc = DC.co_tipo_doc
			left outer join saDocumentoImagen DI 
			inner join saTipoImagen TI ON DI.co_tipo_imag = TI.co_tipo_imag ON DC.rowguid = DI.rowguidDoc
        WHERE
		DI.co_imag is not null and
            ( ( @sNum_doc_d IS NULL
                OR DC.nro_doc >= @sNum_doc_d
              )
              AND ( @sNum_doc_h IS NULL
                    OR DC.nro_doc <= @sNum_doc_h
                  )
            )
            AND ( @sCo_Tip IS NULL
                  OR TP.co_tipo_doc = @sCo_Tip
                )
            AND ( @dFecha_Emis_d IS NULL
                  OR dbo.fechasimple(DC.fec_emis) >= @dFecha_Emis_d
                )
            AND ( @dFecha_Emis_h IS NULL
                  OR dbo.fechasimple(DC.fec_emis) <= @dFecha_Emis_
```
