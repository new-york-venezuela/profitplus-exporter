# SP: RepDocumentoCXCDetalle
**Tipo**: Reporte
**Módulo**: Ventas

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saDocumentoVentaReng`](../tables/saDocumentoVentaReng.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <03-08-10>
-- Description:	<Documentos de Venta con su Detalle>
-- =============================================
CREATE PROCEDURE [dbo].[RepDocumentoCXCDetalle]
	-- Add the parameters for the stored procedure here
    @sNum_doc_d CHAR(20) = NULL ,
    @sNum_doc_h CHAR(20) = NULL ,
    @sCo_Tip CHAR(6) = NULL ,
    @dFecha_Emis_d DATETIME = NULL ,
    @dFecha_Emis_h DATETIME = NULL ,
    @sCo_Cli_d CHAR(16) = NULL ,
    @sCo_Cli_h CHAR(16) = NULL ,
    @sCo_Ven_d CHAR(6) = NULL ,
    @sCo_Ven_h CHAR(6) = NULL ,
    @sCo_Condic CHAR(2) = NULL ,
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
            DV.*, C.cli_des, TP.descrip, 
			TP.tipo_mov, DVR.reng_num, 
			DVR.co_art, DVR.des_art, 
			DVR.tipo_imp, DVR.total_art,
            DVR.prec_vta, DVR.reng_neto
        FROM
            saDocumentoVenta AS DV
            INNER JOIN saCliente AS C ON C.co_cli = DV.co_cli
            LEFT JOIN saTipoDocumento AS TP ON TP.co_tipo_doc = DV.co_tipo_doc
            INNER JOIN saDocumentoVentaReng AS DVR ON DVR.nro_doc = DV.nro_doc AND DV.co_tipo_doc = DVR.co_tipo_doc
        WHERE
            ( ( @sNum_doc_d IS NULL
                OR DV.nro_doc >= @sNum_doc_d
              )
              AND ( @sNum_doc_h IS NULL
                    OR DV.nro_doc <= @sNum_doc_h
                  )
            )
            AND ( @sCo_Tip IS NULL
                  OR TP.co_tipo_doc = @sCo_Tip
                )
            AND ( @dFecha_Emis_d IS NULL
                  OR dbo.fechasimple(DV.fec_emis) >= @dFecha_Emis_d
                )
            AND ( @dFecha_Emis_h IS NULL
                  OR dbo.fechasimple(DV.fec_emis) <= @dFecha_Emis_h
                )
            AND (
```
