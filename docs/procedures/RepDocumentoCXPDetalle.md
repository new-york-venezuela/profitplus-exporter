# SP: RepDocumentoCXPDetalle
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saDocumentoCompraReng`](../tables/saDocumentoCompraReng.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <03-08-10>
-- Description:	<Documentos de Compra con su Detalle>
-- =============================================
CREATE PROCEDURE [RepDocumentoCXPDetalle]
	-- Add the parameters for the stored procedure here
    @sNum_doc_d CHAR(20) = NULL ,
    @sNum_doc_h CHAR(20) = NULL ,
    @sCo_Tip CHAR(6) = NULL ,
    @sFecha_Emis_d DATETIME = NULL ,
    @sFecha_Emis_h DATETIME = NULL ,
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

        SELECT
            DC.*, P.prov_des, 
			TP.descrip, TP.tipo_mov, 
			DCR.reng_num, DCR.co_art, 
			DCR.des_art, DCR.tipo_imp,
            DCR.total_art, DCR.cost_unit, 
			DCR.reng_neto
        FROM
            saDocumentoCompra AS DC
            INNER JOIN saProveedor AS P ON P.co_prov = DC.co_prov
            LEFT JOIN saTipoDocumento AS TP ON TP.co_tipo_doc = DC.co_tipo_doc
            INNER JOIN saDocumentoCompraReng AS DCR ON DCR.nro_doc = DC.nro_doc  AND DC.co_tipo_doc = DCR.co_tipo_doc
        WHERE
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
            AND ( @sFecha_Emis_d IS NULL
                  OR dbo.fechasimple(DC.fec_emis)  >= @sFecha_Emis_d
                )
            AND ( @sFecha_Emis_h IS NULL
                  OR dbo.fechasimple(DC.fec_emis) <= @sFecha_Emis_h
                )
            AND ( ( @sCo_Prov_d IS NULL
                    OR DC.co_prov >= @sCo_Prov_d
                  )
                  AND ( @sCo_Prov_h IS NULL
                        OR DC.co_prov <= @s
```
