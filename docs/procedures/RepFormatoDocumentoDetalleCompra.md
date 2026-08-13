# SP: RepFormatoDocumentoDetalleCompra
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saDocumentoCompraReng`](../tables/saDocumentoCompraReng.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <02/25/2011>
-- Description:	<Reporte de Formato de Documentos con su Detalle Compras>
-- =============================================


CREATE PROCEDURE [RepFormatoDocumentoDetalleCompra] 
	-- Add the parameters for the stored procedure here
    @cCo_Numero_d CHAR(20) = NULL ,
    @cCo_Numero_h CHAR(20) = NULL ,
    @sCo_Tip_d CHAR(6) = NULL ,
    @sCo_Tip_h CHAR(6) = NULL ,
    @cCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

    -- Insert statements for procedure here
        DECLARE @Tipo_doc CHAR(11) ;
        SET @Tipo_doc = 'docucompra' ;
	
        SELECT
            @Tipo_doc AS TIPO_DOC, 'tipo' = 0, ( CL.prov_des ) AS cli_des, CL.rif, CL.telefonos, CL.direc1, CL.direc2, --VE.ven_des, 
            DV.co_tipo_doc, DV.nro_doc, ( DV.co_prov ) AS co_cli, /*DV.co_ven,*/ DV.co_mone, DV.tasa, DV.observa,
            DV.fec_emis, DV.fec_venc, DV.doc_orig, DV.nro_orig, DV.n_control, DV.total_bruto, DV.monto_imp,
            DV.monto_desc_glob, DV.porc_desc_glob, DV.monto_reca, DV.porc_reca,
            ( DV.otros1 + DV.otros2 + DV.otros3 ) AS otros, DVR.co_art, DVR.total_art, DVR.co_uni,
            ( DVR.cost_unit ) AS prec_vta, ( CASE WHEN DVR.porc_desc IS NULL THEN 0.00
                                             END ) AS porc_desc, DVR.porc_imp, DVR.reng_neto, ART.art_des
        FROM
            saDocumentoCompra AS DV
            INNER JOIN saDocumentoCompraReng AS DVR ON DVR.nro_doc = DV.nro_doc AND DV.co_tipo_doc = DVR.co_tipo_doc
            INNER JOIN saProveedor AS CL ON CL.co_prov = DV.co_prov
            INNER JOIN saArticulo AS ART ON ART.co_art = DVR.co_art
        WHERE
            ( ( @cCo_Numero_d IS NULL
                OR DV.nro_doc >= @cCo_Numero_d
              )
              AND ( @cCo_Numero_h IS NULL
                    OR DV.nro_doc <= @cCo_Numero_h
                  )
              AND ( @sCo_Tip_d IS NULL
					OR DV.co_tipo_doc = @sCo_Tip_d
				  )        
            AND ( @sCo_Tip_h IS NULL
                  OR DV.co_tipo_doc = @sCo_Tip_h
            )
            AND ( @cCo_Sucursal IS NULL
                  OR @cCo_Sucursal = DV.co_sucu_in
                )
            AND ( DV.anulado = 0 )
				)
            
        ORDER BY
            DV.nro_doc ASC
```
