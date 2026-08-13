# SP: RepDocumentoCXCXCobro
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saCobro`](../tables/saCobro.md)
- [`saCobroDocReng`](../tables/saCobroDocReng.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <07-02-11>
-- Description:	<Documentos de  Venta con su Cobro>
-- =============================================
CREATE PROCEDURE [dbo].[RepDocumentoCXCXCobro]
	-- Add the parameters for the stored procedure here
    @sNum_doc_d CHAR(20) = NULL ,
    @sNum_doc_h CHAR(20) = NULL ,
    @sTipo_doc CHAR(6) = NULL ,
    @dFecha_d DATETIME = NULL ,
    @dFecha_h DATETIME = NULL ,
    @sCo_Cli_d CHAR(16) = NULL ,
    @sCo_Cli_h CHAR(16) = NULL ,
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
	
        DECLARE @fechadiff INT ;
        SET @fechadiff = DATEDIFF(dd, 00, GETDATE()) ;
 
        IF @dFecha_h IS NOT NULL 
            SET @dFecha_h = DATEADD(ss, -60, DATEADD(day, 1, @dFecha_h))

        --IF @dFecha_d IS NOT NULL 
        --    SET @dFecha_d = DATEADD(ss, -60, DATEADD(day, 1, @dFecha_d))

        SELECT
            'Cobro' AS tipo, A.*
        FROM
            ( SELECT DISTINCT
                DC.co_cli AS co_prov, 
				P.cli_des AS prov_des, 
				DC.co_tipo_doc, 
				DC.nro_doc, 
				DC.anulado, 
				dbo.fechasimple(DC.fec_emis) as fec_emis,
                dbo.fechasimple(DC.fec_venc) as fec_venc, 
				DC.observa, ( DC.TOTAL_NETO - B.mont_cob_sal ) * ( CASE WHEN TD.tipo_mov = 'DE' THEN 1
                                                                                     ELSE -1
                                                                                END ) AS saldo, 0.00 AS mont_cob,
                '' AS cob_num, '' AS Fec_pag, '' AS anulado_pago, '' AS fecha_Pag, '' AS fecha_emision,
                DC.total_neto * ( CASE WHEN TD.tipo_mov = 'DE' THEN 1
                                       ELSE -1
                                  END ) AS total_neto, DC.co_sucu_in, TD.tipo_mov, DC.nro_orig, DC.doc_orig, DC.co_mone,
                DC.tasa, '' AS forma_pag, '' AS num_doc, 'SI' AS pago_adel
              FROM
                saDocumentoVenta AS dc
                INNER JOIN ( SELECT DISTINCT
                                DC.co_tipo_doc, DC.nro_doc,
                                I
```
